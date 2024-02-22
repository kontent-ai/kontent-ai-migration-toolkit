import {
    CollectionModels,
    ContentItemModels,
    ContentTypeElements,
    ContentTypeModels,
    ContentTypeSnippetModels,
    ManagementClient,
    WorkflowModels,
    createManagementClient
} from '@kontent-ai/management-sdk';

import {
    IImportedData,
    defaultRetryStrategy,
    defaultHttpService,
    logDebug,
    logErrorAndExit,
    IMigrationItem,
    executeWithTrackingAsync,
    packageVersion
} from '../core/index.js';
import { IImportConfig, IImportSource, IImportContentType, IImportContentTypeElement } from './import.models.js';
import { ImportAssetsHelper, getImportAssetsHelper } from './helpers/import-assets.helper.js';
import { ImportContentItemHelper, getImportContentItemHelper } from './helpers/import-content-item.helper.js';
import {
    ImportLanguageVariantHelper,
    getImportLanguageVariantstemHelper
} from './helpers/import-language-variant.helper.js';
import colors from 'colors';

export class ImportService {
    private readonly managementClient: ManagementClient;
    private readonly importAssetsHelper: ImportAssetsHelper;
    private readonly importContentItemHelper: ImportContentItemHelper;
    private readonly importLanguageVariantHelper: ImportLanguageVariantHelper;

    constructor(private config: IImportConfig) {
        this.managementClient = createManagementClient({
            apiKey: config.managementApiKey,
            baseUrl: config.baseUrl,
            environmentId: config.environmentId,
            httpService: defaultHttpService,
            retryStrategy: config.retryStrategy ?? defaultRetryStrategy
        });

        this.importAssetsHelper = getImportAssetsHelper({ logLevel: config.logLevel ?? 'default' });
        this.importContentItemHelper = getImportContentItemHelper({
            logLevel: config.logLevel ?? 'default',
            skipFailedItems: config.skipFailedItems,
            fetchMode: config?.contentItemsFetchMode ?? 'oneByOne'
        });
        this.importLanguageVariantHelper = getImportLanguageVariantstemHelper({
            logLevel: config.logLevel ?? 'default',
            skipFailedItems: config.skipFailedItems
        });
    }

    async printInfoAsync(): Promise<void> {
        const environmentInformation = (await this.managementClient.environmentInformation().toPromise()).data;

        logDebug({
            type: 'info',
            message: `Importing into '${colors.yellow(
                environmentInformation.project.environment
            )}' environment of project '${colors.yellow(environmentInformation.project.name)}'`
        });
    }

    async getImportContentTypesAsync(): Promise<IImportContentType[]> {
        const contentTypes = (await this.managementClient.listContentTypes().toAllPromise()).data.items;
        const contentTypeSnippets = (await this.managementClient.listContentTypeSnippets().toAllPromise()).data.items;

        logDebug({
            type: 'info',
            message: `Fetched '${colors.yellow(contentTypes.length.toString())}' content types`
        });

        logDebug({
            type: 'info',
            message: `Fetched '${colors.yellow(contentTypeSnippets.length.toString())}' content type snippets`
        });

        return [
            ...contentTypes.map((contentType) => {
                const importType: IImportContentType = {
                    contentTypeCodename: contentType.codename,
                    elements: this.getContentTypeElements(contentType, contentTypeSnippets)
                };

                return importType;
            })
        ];
    }

    async importAsync(sourceData: IImportSource): Promise<IImportedData> {
        return await executeWithTrackingAsync({
            event: {
                tool: 'migration-toolkit',
                version: packageVersion,
                action: 'import',
                relatedEnvironmentId: this.config.environmentId,
                details: {
                    logLevel: this.config.logLevel,
                    skipFailedItems: this.config.skipFailedItems,
                    itemsCount: sourceData.importData.items.length,
                    assetsCount: sourceData.importData.assets.length
                }
            },
            func: async () => {
                const importedData: IImportedData = {
                    assets: [],
                    contentItems: [],
                    languageVariants: []
                };

                // this is an optional step where users can exclude certain objects from being imported
                const dataToImport = this.getDataToImport(sourceData);

                // import order matters
                // #1 Assets
                if (dataToImport.importData.assets.length) {
                    logDebug({
                        type: 'info',
                        message: `Importing assets`
                    });
                    await this.importAssetsHelper.importAssetsAsync({
                        managementClient: this.managementClient,
                        assets: dataToImport.importData.assets,
                        importedData: importedData
                    });
                } else {
                    logDebug({
                        type: 'info',
                        message: `There are no assets to import`
                    });
                }

                // #2 Content items
                if (dataToImport.importData.items.length) {
                    logDebug({
                        type: 'info',
                        message: `Importing content items`
                    });
                    await this.importMigrationContentItemAsync(dataToImport.importData.items, importedData);
                } else {
                    logDebug({
                        type: 'info',
                        message: `There are no content items to import`
                    });
                }

                logDebug({
                    type: 'info',
                    message: `Finished import`
                });

                return importedData;
            }
        });
    }

    private getContentTypeElements(
        contentType: ContentTypeModels.ContentType,
        contentTypeSnippets: ContentTypeSnippetModels.ContentTypeSnippet[]
    ): IImportContentTypeElement[] {
        const elements: IImportContentTypeElement[] = [];

        for (const element of contentType.elements) {
            if (!element.codename) {
                continue;
            }
            const importElement: IImportContentTypeElement = {
                codename: element.codename,
                type: element.type
            };

            if (importElement.type === 'snippet') {
                const snippetElement = element as ContentTypeElements.ISnippetElement;

                // replace snippet element with actual elements
                const contentTypeSnippet = contentTypeSnippets.find(
                    (m) => m.id.toLowerCase() === snippetElement.snippet.id?.toLowerCase()
                );

                if (!contentTypeSnippet) {
                    logErrorAndExit({
                        message: `Could not find content type snippet for element. This snippet is referenced in type '${colors.red(
                            contentType.codename
                        )}'`
                    });
                }

                for (const snippetElement of contentTypeSnippet.elements) {
                    if (!snippetElement.codename) {
                        continue;
                    }

                    elements.push({
                        codename: snippetElement.codename,
                        type: snippetElement.type
                    });
                }
            } else {
                elements.push(importElement);
            }
        }

        return elements;
    }

    private getDataToImport(source: IImportSource): IImportSource {
        const dataToImport: IImportSource = {
            importData: {
                assets: [],
                items: []
            }
        };

        let removedAssets: number = 0;
        let removedContentItems: number = 0;

        if (this.config?.canImport?.asset) {
            for (const asset of source.importData.assets) {
                const canImport = this.config.canImport.asset(asset);
                if (canImport) {
                    dataToImport.importData.assets.push(asset);
                } else {
                    removedAssets++;
                }
            }
        } else {
            dataToImport.importData.assets = source.importData.assets;
        }

        if (this.config?.canImport?.contentItem) {
            for (const item of source.importData.items) {
                const canImport = this.config.canImport.contentItem(item);
                if (canImport) {
                    dataToImport.importData.items.push(item);
                } else {
                    removedContentItems++;
                }
            }
        } else {
            dataToImport.importData.items = source.importData.items;
        }

        if (removedAssets > 0) {
            logDebug({
                type: 'info',
                message: `Removed '${colors.yellow(removedAssets.toString())}' assets from import`
            });
        }

        if (removedContentItems) {
            logDebug({
                type: 'info',
                message: `Removed '${colors.yellow(removedContentItems.toString())}' content items from import`
            });
        }

        return dataToImport;
    }

    private async importMigrationContentItemAsync(
        migrationContentItem: IMigrationItem[],
        importedData: IImportedData
    ): Promise<void> {
        const workflows = await this.getWorkflowsAsync();
        const collections = await this.getCollectionsAsync();

        // first prepare content items
        const preparedContentItems: ContentItemModels.ContentItem[] =
            await this.importContentItemHelper.importContentItemsAsync({
                managementClient: this.managementClient,
                collections: collections,
                importedData: importedData,
                migrationContentItems: migrationContentItem
            });

        // then process language variants
        await this.importLanguageVariantHelper.importLanguageVariantsAsync({
            managementClient: this.managementClient,
            importContentItems: migrationContentItem,
            importedData: importedData,
            preparedContentItems: preparedContentItems,
            workflows: workflows
        });
    }

    private async getWorkflowsAsync(): Promise<WorkflowModels.Workflow[]> {
        return await this.managementClient
            .listWorkflows()
            .toPromise()
            .then((m) => m.data);
    }

    private async getCollectionsAsync(): Promise<CollectionModels.Collection[]> {
        return await this.managementClient
            .listCollections()
            .toPromise()
            .then((m) => m.data.collections);
    }
}
