import { HttpService } from '@kontent-ai/core-sdk';
import {
    IExportAdapter,
    IExportAdapterResult,
    IExportContext,
    IDefaultExportAdapterConfig,
    IKontentAiPreparedExportItem
} from '../export.models.js';
import chalk from 'chalk';
import {
    AssetModels,
    CollectionModels,
    ManagementClient,
    SharedModels,
    createManagementClient
} from '@kontent-ai/management-sdk';
import {
    defaultRetryStrategy,
    IMigrationAsset,
    IMigrationElement,
    IMigrationItem,
    defaultHttpService,
    IFlattenedContentTypeElement,
    extractErrorData,
    processInChunksAsync,
    getAssetExternalIdForCodename
} from '../../core/index.js';
import { ExportContextService, getExportContextService } from './context/export-context.service.js';
import { exportTransforms } from '../../translation/index.js';
import { throwErrorForItemRequest } from '../utils/export.utils.js';

export function getDefaultExportAdapter(config: IDefaultExportAdapterConfig): IExportAdapter {
    return new DefaultExportAdapter(config);
}

class DefaultExportAdapter implements IExportAdapter {
    public readonly name: string = 'Kontent.ai export adapter';

    private readonly httpService: HttpService = new HttpService();
    private readonly managementClient: ManagementClient;
    private readonly exportContextService: ExportContextService;

    constructor(private config: IDefaultExportAdapterConfig) {
        this.managementClient = this.getManagementClient(config);
        this.exportContextService = getExportContextService(this.config.log, this.managementClient);
    }

    async exportAsync(): Promise<IExportAdapterResult> {
        this.config.log.console({
            type: 'info',
            message: `Preparing to export data`
        });

        const exportContext = await this.exportContextService.getExportContextAsync({
            exportItems: this.config.exportItems
        });

        return {
            items: await this.mapPreparedItemToMigrationItemsAsync(exportContext),
            assets: await this.exportAssetsAsync(exportContext)
        };
    }

    private async mapPreparedItemToMigrationItemsAsync(context: IExportContext): Promise<IMigrationItem[]> {
        const migrationItems: IMigrationItem[] = [];

        for (const preparedItem of context.preparedExportItems) {
            migrationItems.push({
                system: {
                    codename: preparedItem.contentItem.codename,
                    collection: preparedItem.collection.codename,
                    language: preparedItem.language.codename,
                    name: preparedItem.contentItem.name,
                    type: preparedItem.contentType.contentTypeCodename,
                    workflow: preparedItem.workflow.codename,
                    workflow_step: preparedItem.workflowStepCodename
                },
                elements: this.getMigrationElements(preparedItem, context)
            });
        }

        return migrationItems;
    }

    private getMigrationElements(
        exportItem: IKontentAiPreparedExportItem,
        context: IExportContext
    ): IMigrationElement[] {
        const migrationElements: IMigrationElement[] = [];

        for (const typeElement of exportItem.contentType.elements) {
            const languageElement = exportItem.languageVariant.elements.find((m) => m.element.id === typeElement.id);

            if (!languageElement) {
                throwErrorForItemRequest(
                    exportItem.requestItem,
                    `Could not find element '${typeElement.codename}' in language variant'`
                );
            }

            migrationElements.push({
                codename: typeElement.codename,
                type: typeElement.type,
                value: this.getValueToStoreFromElement({
                    context: context,
                    exportItem: exportItem,
                    value: languageElement.value,
                    typeElement: typeElement
                })
            });
        }

        return migrationElements;
    }

    private getValueToStoreFromElement(data: {
        exportItem: IKontentAiPreparedExportItem;
        typeElement: IFlattenedContentTypeElement;
        value: string | number | SharedModels.ReferenceObject[] | undefined;
        context: IExportContext;
    }): string | undefined | string[] {
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

    private async exportAssetsAsync(context: IExportContext): Promise<IMigrationAsset[]> {
        const assets: AssetModels.Asset[] = [];

        for (const assetId of context.referencedData.assetIds) {
            const assetState = context.getAssetStateInSourceEnvironment(assetId);

            if (assetState.asset) {
                assets.push(assetState.asset);
            }
        }

        return await this.getMigrationAssetsWithBinaryDataAsync(assets, context);
    }

    private getManagementClient(config: IDefaultExportAdapterConfig): ManagementClient {
        const retryStrategy = config.retryStrategy ?? defaultRetryStrategy;

        return createManagementClient({
            environmentId: config.environmentId,
            retryStrategy: retryStrategy,
            httpService: defaultHttpService,
            apiKey: config.apiKey
        });
    }

    private async getMigrationAssetsWithBinaryDataAsync(
        assets: AssetModels.Asset[],
        context: IExportContext
    ): Promise<IMigrationAsset[]> {
        this.config.log.console({
            type: 'info',
            message: `Preparing to download '${chalk.yellow(assets.length.toString())}' assets`
        });

        const exportedAssets: IMigrationAsset[] = await processInChunksAsync<AssetModels.Asset, IMigrationAsset>({
            log: this.config.log,
            type: 'asset',
            chunkSize: 5,
            itemInfo: (input) => {
                return {
                    title: input.codename,
                    itemType: 'asset'
                };
            },
            items: assets,
            processFunc: async (asset) => {
                const assetCollection: CollectionModels.Collection | undefined =
                    context.environmentData.collections.find((m) => m.id === asset.collection?.reference?.id);

                const migrationAsset: IMigrationAsset = {
                    _zipFilename: asset.codename,
                    filename: asset.fileName,
                    title: asset.title ?? '',
                    externalId: asset.externalId ?? getAssetExternalIdForCodename(asset.codename),
                    codename: asset.codename,
                    binaryData: (await this.getBinaryDataFromUrlAsync(asset.url)).data,
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

    private async getBinaryDataFromUrlAsync(url: string): Promise<{ data: any; contentLength: number }> {
        // temp fix for Kontent.ai Repository not validating url
        url = url.replace('#', '%23');

        const response = await this.httpService.getAsync(
            {
                url
            },
            {
                responseType: 'arraybuffer',
                retryStrategy: defaultRetryStrategy
            }
        );

        const contentLengthHeader = response.headers.find((m) => m.header.toLowerCase() === 'content-length');
        const contentLength = contentLengthHeader ? +contentLengthHeader.value : 0;

        return { data: response.data, contentLength: contentLength };
    }
}
