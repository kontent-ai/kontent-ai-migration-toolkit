import {
    ExportAdapter,
    ExportAdapterResult,
    ExportContext,
    DefaultExportAdapterConfig,
    ExportItem
} from '../export.models.js';
import chalk from 'chalk';
import {
    AssetModels,
    CollectionModels,
    ElementModels,
    ManagementClient,
    createManagementClient
} from '@kontent-ai/management-sdk';
import {
    defaultRetryStrategy,
    MigrationAsset,
    MigrationItem,
    defaultHttpService,
    FlattenedContentTypeElement,
    extractErrorData,
    processInChunksAsync,
    getBinaryDataFromUrlAsync,
    MigrationElementValue,
    MigrationElements,
    FlattenedContentType,
    MigrationComponent
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

        for (const exportItem of context.exportItems) {
            try {
                migrationItems.push(this.mapToMigrationItem(context, exportItem));
            } catch (error) {
                if (this.config.skipFailedItems) {
                    this.config.logger.log({
                        type: 'warning',
                        message: `Failed to export item '${chalk.yellow(
                            exportItem.requestItem.itemCodename
                        )}' in language '${chalk.yellow(exportItem.requestItem.languageCodename)}'`
                    });
                } else {
                    throwErrorForItemRequest(exportItem.requestItem, extractErrorData(error).message);
                }
            }
        }

        return migrationItems;
    }

    private mapToMigrationItem(context: ExportContext, exportItem: ExportItem): MigrationItem {
        const migrationItem: MigrationItem = {
            system: {
                name: exportItem.contentItem.name,
                codename: exportItem.contentItem.codename,
                language: { codename: exportItem.language.codename },
                type: { codename: exportItem.contentType.contentTypeCodename },
                collection: { codename: exportItem.collection.codename },
                workflow: {
                    codename: exportItem.workflow.codename
                },
                workflow_step: { codename: exportItem.workflowStepCodename }
            },
            elements: this.getMigrationElements(context, exportItem.contentType, exportItem.languageVariant.elements)
        };

        return migrationItem;
    }

    private maToMigrationComponent(
        context: ExportContext,
        component: ElementModels.ContentItemElementComponent
    ): MigrationComponent {
        const componentType = context.environmentData.contentTypes.find((m) => m.contentTypeId === component.type.id);

        if (!componentType) {
            throw Error(
                `Could not find content type with id '${chalk.red(component.type.id)}' for component '${chalk.red(
                    component.id
                )}'`
            );
        }

        const migrationItem: MigrationComponent = {
            system: {
                id: component.id,
                type: {
                    codename: componentType.contentTypeCodename
                }
            },
            elements: this.getMigrationElements(context, componentType, component.elements)
        };

        return migrationItem;
    }

    private getMigrationElements(
        context: ExportContext,
        contentType: FlattenedContentType,
        elements: ElementModels.ContentItemElement[]
    ): MigrationElements {
        const migrationModel: MigrationElements = {};
        const sortedContentTypeElements = contentType.elements.sort((a, b) => {
            if (a.codename < b.codename) {
                return -1;
            }
            if (a.codename > b.codename) {
                return 1;
            }
            return 0;
        });

        for (const typeElement of sortedContentTypeElements) {
            const itemElement = elements.find((m) => m.element.id === typeElement.id);

            if (!itemElement) {
                throw new Error(`Could not find element '${chalk.red(typeElement.codename)}'`);
            }

            migrationModel[typeElement.codename] = {
                type: typeElement.type,
                value: this.getValueToStoreFromElement({
                    context: context,
                    contentType: contentType,
                    exportElement: itemElement,
                    typeElement: typeElement
                })
            };
        }

        return migrationModel;
    }

    private getValueToStoreFromElement(data: {
        context: ExportContext;
        contentType: FlattenedContentType;
        typeElement: FlattenedContentTypeElement;
        exportElement: ElementModels.ContentItemElement;
    }): MigrationElementValue {
        try {
            return exportTransforms[data.typeElement.type]({
                context: data.context,
                typeElement: data.typeElement,
                exportElement: {
                    components: data.exportElement.components.map((component) =>
                        this.maToMigrationComponent(data.context, component)
                    ),
                    value: data.exportElement.value,
                    urlSlugMode: data.exportElement.mode
                }
            });
        } catch (error) {
            const errorData = extractErrorData(error);
            let jsonValue = 'n/a';

            try {
                jsonValue = JSON.stringify(data.exportElement.value);
            } catch (jsonError) {
                console.error(`Failed to convert json value`, jsonError);
            }

            throw new Error(
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

                logSpinner({
                    type: 'download',
                    message: `${asset.url}`
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
                                `Could not find language with id '${chalk.red(
                                    description.language.id
                                )}' requested by asset '${chalk.red(asset.codename)}'`
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
