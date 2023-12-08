import {
    CollectionModels,
    ContentItemModels,
    ContentTypeElements,
    ContentTypeModels,
    ContentTypeSnippetModels,
    ManagementClient,
    WorkflowModels
} from '@kontent-ai/management-sdk';

import {
    IImportedData,
    defaultRetryStrategy,
    printProjectAndEnvironmentInfoToConsoleAsync,
    defaultHttpService,
    logDebug,
    logErrorAndExit
} from '../core/index.js';
import {
    IImportConfig,
    IParsedContentItem,
    IImportSource,
    IImportContentType,
    IImportContentTypeElement
} from './import.models.js';
import { importAssetsHelper } from './helpers/import-assets.helper.js';
import { importContentItemHelper } from './helpers/import-content-item.helper.js';
import { importLanguageVariantHelper } from './helpers/import-language-variant.helper.js';

export class ImportService {
    private readonly managementClient: ManagementClient;

    constructor(private config: IImportConfig) {
        this.managementClient = new ManagementClient({
            apiKey: config.managementApiKey,
            baseUrl: config.baseUrl,
            environmentId: config.environmentId,
            httpService: defaultHttpService,
            retryStrategy: config.retryStrategy ?? defaultRetryStrategy
        });
    }

    async getImportContentTypesAsync(): Promise<IImportContentType[]> {
        logDebug({
            type: 'info',
            message: `Fetching content types from environment`
        });

        const contentTypes = (await this.managementClient.listContentTypes().toAllPromise()).data.items;
        const contentTypeSnippets = (await this.managementClient.listContentTypeSnippets().toAllPromise()).data.items;

        logDebug({
            type: 'info',
            message: `Fetched '${contentTypes.length}' content types`
        });

        logDebug({
            type: 'info',
            message: `Fetched '${contentTypeSnippets.length}' content type snippets`
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
        const importedData: IImportedData = {
            assets: [],
            contentItems: [],
            languageVariants: []
        };
        await printProjectAndEnvironmentInfoToConsoleAsync(this.managementClient);

        // this is an optional step where users can exclude certain objects from being imported
        const dataToImport = this.getDataToImport(sourceData);

        // import order matters
        // #1 Assets
        if (dataToImport.importData.assets.length) {
            logDebug({
                type: 'info',
                message: `Importing assets`
            });
            await importAssetsHelper.importAssetsAsync({
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
            await this.importParsedContentItemsAsync(dataToImport.importData.items, importedData);
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
                        message: `Could not find content type snippet for element. This snippet is referenced in type '${contentType.codename}'`
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
            },
            metadata: source.metadata
        };

        let removedAssets: number = 0;
        let removedContentItems: number = 0;

        if (this.config?.canImport?.asset) {
            for (const asset of source.importData.assets) {
                const canImport = this.config.canImport.asset(asset);
                if (canImport) {
                    dataToImport.importData.assets.push(asset);
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
                    removedContentItems++;
                }
            }
        } else {
            dataToImport.importData.items = source.importData.items;
        }

        if (removedAssets > 0) {
            logDebug({
                type: 'info',
                message: `Removed '${removedAssets.toString()}' assets from import`
            });
        }

        if (removedContentItems) {
            logDebug({
                type: 'info',
                message: `Removed '${removedContentItems.toString()}' content items from import`
            });
        }

        return dataToImport;
    }

    private async importParsedContentItemsAsync(
        parsedContentItems: IParsedContentItem[],
        importedData: IImportedData
    ): Promise<void> {
        const workflows = await this.getWorkflowsAsync();
        const collections = await this.getCollectionsAsync();

        // first prepare content items
        const preparedContentItems: ContentItemModels.ContentItem[] =
            await importContentItemHelper.importContentItemsAsync({
                managementClient: this.managementClient,
                collections: collections,
                importedData: importedData,
                parsedContentItems: parsedContentItems,
                config: {
                    skipFailedItems: this.config.skipFailedItems
                }
            });

        // then process language variants
        await importLanguageVariantHelper.importLanguageVariantsAsync({
            managementClient: this.managementClient,
            importContentItems: parsedContentItems,
            importedData: importedData,
            preparedContentItems: preparedContentItems,
            workflows: workflows,
            config: {
                skipFailedItems: this.config.skipFailedItems
            }
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
