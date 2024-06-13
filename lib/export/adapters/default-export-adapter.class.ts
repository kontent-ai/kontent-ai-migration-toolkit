import {
    ExportAdapter,
    ExportAdapterResult,
    ExportContext,
    DefaultExportAdapterConfig,
    KontentAiPreparedExportItem,
    ExportElementValue
} from '../export.models.js';
import chalk from 'chalk';
import { AssetModels, CollectionModels, ManagementClient, createManagementClient } from '@kontent-ai/management-sdk';
import {
    defaultRetryStrategy,
    MigrationAsset,
    MigrationItem,
    defaultHttpService,
    FlattenedContentTypeElement,
    extractErrorData,
    processInChunksAsync,
    getBinaryDataFromUrlAsync,
    logSpinnerOrDefaultAsync,
    MigrationElementValue,
    MigrationElements
} from '../../core/index.js';
import { exportTransforms } from '../../translation/index.js';
import { throwErrorForItemRequest } from '../utils/export.utils.js';
import { exportContextFetcher } from '../context/export-context-fetcher.js';

export class DefaultExportAdapter implements ExportAdapter {
    public readonly name: string = 'Kontent.ai export adapter';

    private readonly managementClient: ManagementClient;

    constructor(private readonly config: DefaultExportAdapterConfig) {
        this.managementClient = createManagementClient({
            environmentId: config.environmentId,
            retryStrategy: config.retryStrategy ?? defaultRetryStrategy,
            httpService: defaultHttpService,
            apiKey: config.apiKey
        });
    }

    async exportAsync(): Promise<ExportAdapterResult> {
        this.config.logger.log({
            type: 'info',
            message: `Preparing to export data`
        });

        const exportContext = await exportContextFetcher({
            exportItems: this.config.exportItems,
            logger: this.config.logger,
            managementClient: this.managementClient
        }).getExportContextAsync();

        return {
            items: this.getMigrationItems(exportContext),
            assets: await this.exportAssetsAsync(exportContext)
        };
    }

    private getMigrationItems(context: ExportContext): MigrationItem[] {
        const migrationItems: MigrationItem[] = [];

        for (const preparedItem of context.preparedExportItems) {
            try {
                migrationItems.push({
                    system: {
                        name: preparedItem.contentItem.name,
                        codename: preparedItem.contentItem.codename,
                        language: { codename: preparedItem.language.codename },
                        type: { codename: preparedItem.contentType.contentTypeCodename },
                        collection: { codename: preparedItem.collection.codename },
                        workflow: {
                            codename: preparedItem.workflow.codename
                        },
                        workflow_step: { codename: preparedItem.workflowStepCodename }
                    },
                    elements: this.getMigrationElements(preparedItem, context)
                });
            } catch (error) {
                if (this.config.skipFailedItems) {
                    this.config.logger.log({
                        type: 'warning',
                        message: `Failed to export item '${chalk.yellow(
                            preparedItem.requestItem.itemCodename
                        )}' in language '${chalk.yellow(preparedItem.requestItem.languageCodename)}'`
                    });
                } else {
                    throw error;
                }
            }
        }

        return migrationItems;
    }

    private getMigrationElements(exportItem: KontentAiPreparedExportItem, context: ExportContext): MigrationElements {
        const migrationModel: MigrationElements = {};
        const sortedContentTypeElements = exportItem.contentType.elements.sort((a, b) => {
            if (a.codename < b.codename) {
                return -1;
            }
            if (a.codename > b.codename) {
                return 1;
            }
            return 0;
        });

        for (const typeElement of sortedContentTypeElements) {
            const itemElement = exportItem.languageVariant.elements.find((m) => m.element.id === typeElement.id);

            if (!itemElement) {
                throwErrorForItemRequest(
                    exportItem.requestItem,
                    `Could not find element '${typeElement.codename}' in language variant'`
                );
            }

            migrationModel[typeElement.codename] = {
                type: typeElement.type,
                value: this.getValueToStoreFromElement({
                    context: context,
                    exportItem: exportItem,
                    value: itemElement.value,
                    typeElement: typeElement
                })
            };
        }

        return migrationModel;
    }

    private getValueToStoreFromElement(data: {
        exportItem: KontentAiPreparedExportItem;
        typeElement: FlattenedContentTypeElement;
        value: ExportElementValue;
        context: ExportContext;
    }): MigrationElementValue {
        try {
            return exportTransforms[data.typeElement.type](data);
        } catch (error) {
            const errorData = extractErrorData(error);
            let jsonValue = 'n/a';

            try {
                jsonValue = JSON.stringify(data.value);
            } catch (jsonError) {
                console.error(`Failed to convert json value`, jsonError);
            }

            throwErrorForItemRequest(
                data.exportItem.requestItem,
                `Failed to map value of element '${chalk.yellow(data.typeElement.codename)}' of type '${chalk.cyan(
                    data.typeElement.type
                )}'. Value: ${chalk.bgMagenta(jsonValue)}. Message: ${errorData.message}`
            );
        }
    }

    private async exportAssetsAsync(context: ExportContext): Promise<MigrationAsset[]> {
        const assets: AssetModels.Asset[] = [];

        for (const assetId of context.referencedData.assetIds) {
            const assetState = context.getAssetStateInSourceEnvironment(assetId);

            if (assetState.asset) {
                assets.push(assetState.asset);
            }
        }

        return await this.getMigrationAssetsWithBinaryDataAsync(assets, context);
    }

    private async getMigrationAssetsWithBinaryDataAsync(
        assets: AssetModels.Asset[],
        context: ExportContext
    ): Promise<MigrationAsset[]> {
        this.config.logger.log({
            type: 'info',
            message: `Preparing to download '${chalk.yellow(assets.length.toString())}' assets`
        });

        const exportedAssets: MigrationAsset[] = await processInChunksAsync<AssetModels.Asset, MigrationAsset>({
            logger: this.config.logger,
            chunkSize: 1,
            itemInfo: (input) => {
                return {
                    title: input.codename,
                    itemType: 'asset'
                };
            },
            items: assets,
            processAsync: async (asset, logSpinner) => {
                const assetCollection: CollectionModels.Collection | undefined =
                    context.environmentData.collections.find((m) => m.id === asset.collection?.reference?.id);

                await logSpinnerOrDefaultAsync({
                    logger: this.config.logger,
                    logData: {
                        type: 'download',
                        message: `${asset.url}`
                    },
                    logSpinner: logSpinner
                });

                const binaryData = await getBinaryDataFromUrlAsync(asset.url);

                const migrationAsset: MigrationAsset = {
                    _zipFilename: asset.codename,
                    filename: asset.fileName,
                    title: asset.title ?? '',
                    codename: asset.codename,
                    binaryData: binaryData.data,
                    collection: assetCollection ? { codename: assetCollection.codename } : undefined,
                    descriptions: asset.descriptions.map((description) => {
                        const language = context.environmentData.languages.find(
                            (m) => m.id === description.language.id
                        );

                        if (!language) {
                            throw Error(
                                `Could not find language with id '${description.language.id}' requested by asset '${asset.codename}'`
                            );
                        }

                        return {
                            description: description.description ?? undefined,
                            language: {
                                codename: language.codename
                            }
                        };
                    })
                };

                return migrationAsset;
            }
        });

        return exportedAssets;
    }
}
