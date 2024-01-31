import { CollectionModels, ContentItemModels, ManagementClient } from '@kontent-ai/management-sdk';
import {
    IImportedData,
    extractErrorMessage,
    is404Error,
    logItemAction,
    logDebug,
    logErrorAndExit,
    processInChunksAsync,
    LogLevel
} from '../../core/index.js';
import { IParsedContentItem } from '../import.models.js';
import { ICategorizedParsedItems, parsedItemsHelper } from './parsed-items-helper.js';
import colors from 'colors';

export function getImportContentItemHelper(config: {
    logLevel: LogLevel;
    skipFailedItems: boolean;
}): ImportContentItemHelper {
    return new ImportContentItemHelper(config.logLevel, config.skipFailedItems);
}

export class ImportContentItemHelper {
    private readonly importContentItemChunkSize: number = 3;

    constructor(private readonly logLevel: LogLevel, private readonly skipFailedItems: boolean) {}

    async importContentItemsAsync(data: {
        managementClient: ManagementClient;
        parsedContentItems: IParsedContentItem[];
        collections: CollectionModels.Collection[];
        importedData: IImportedData;
    }): Promise<ContentItemModels.ContentItem[]> {
        const preparedItems: ContentItemModels.ContentItem[] = [];

        const categorizedParsedItems: ICategorizedParsedItems = parsedItemsHelper.categorizeParsedItems(
            data.parsedContentItems
        );

        logItemAction(this.logLevel, 'skip', 'contentItem', {
            title: `Skipping '${colors.yellow(
                categorizedParsedItems.componentItems.length.toString()
            )}' because they represent component items`
        });

        await processInChunksAsync<IParsedContentItem, void>({
            chunkSize: this.importContentItemChunkSize,
            items: categorizedParsedItems.regularItems,
            itemInfo: (input, output) => {
                return {
                    itemType: 'contentItem',
                    title: input.system.name,
                    partA: input.system.type
                };
            },
            processFunc: async (importContentItem) => {
                try {
                    await this.importContentItemAsync({
                        managementClient: data.managementClient,
                        collections: data.collections,
                        importContentItem: importContentItem,
                        importedData: data.importedData,
                        parsedContentItems: data.parsedContentItems,
                        preparedItems: preparedItems
                    });
                } catch (error) {
                    if (this.skipFailedItems) {
                        logDebug({
                            type: 'error',
                            message: `Failed to import content item`,
                            partA: importContentItem.system.codename,
                            partB: extractErrorMessage(error)
                        });
                    } else {
                        throw error;
                    }
                }
            }
        });

        return preparedItems;
    }

    private async importContentItemAsync(data: {
        importContentItem: IParsedContentItem;
        managementClient: ManagementClient;
        parsedContentItems: IParsedContentItem[];
        collections: CollectionModels.Collection[];
        importedData: IImportedData;
        preparedItems: ContentItemModels.ContentItem[];
    }): Promise<void> {
        const preparedContentItemResult = await this.prepareContentItemAsync(
            data.managementClient,
            data.importContentItem,
            data.importedData
        );
        data.preparedItems.push(preparedContentItemResult.contentItem);

        // check if name should be updated, no other changes are supported
        if (preparedContentItemResult.status === 'itemAlreadyExists') {
            if (
                this.shouldUpdateContentItem(
                    data.importContentItem,
                    preparedContentItemResult.contentItem,
                    data.collections
                )
            ) {
                logItemAction(this.logLevel, 'upsert', 'contentItem', {
                    title: `${data.importContentItem.system.name}`,
                    codename: data.importContentItem.system.codename
                });

                await data.managementClient
                    .upsertContentItem()
                    .byItemCodename(data.importContentItem.system.codename)
                    .withData({
                        name: data.importContentItem.system.name,
                        collection: {
                            codename: data.importContentItem.system.collection
                        }
                    })
                    .toPromise()
                    .then((m) => m.data);
            } else {
                logItemAction(this.logLevel, 'skip', 'contentItem', {
                    title: `${data.importContentItem.system.name}`,
                    codename: data.importContentItem.system.codename
                });
            }
        }
    }

    private shouldUpdateContentItem(
        parsedContentItem: IParsedContentItem,
        contentItem: ContentItemModels.ContentItem,
        collections: CollectionModels.Collection[]
    ): boolean {
        const collection = collections.find((m) => m.codename === parsedContentItem.system.collection);

        if (!collection) {
            logErrorAndExit({
                message: `Invalid collection '${parsedContentItem.system.collection}'`
            });
        }
        return (
            parsedContentItem.system.name !== contentItem.name ||
            parsedContentItem.system.collection !== collection.codename
        );
    }

    private async prepareContentItemAsync(
        managementClient: ManagementClient,
        parsedContentItem: IParsedContentItem,
        importedData: IImportedData
    ): Promise<{ contentItem: ContentItemModels.ContentItem; status: 'created' | 'itemAlreadyExists' }> {
        try {
            const contentItem = await managementClient
                .viewContentItem()
                .byItemCodename(parsedContentItem.system.codename)
                .toPromise()
                .then((m) => m.data);

            logItemAction(this.logLevel, 'fetch', 'contentItem', {
                title: `${contentItem.name}`,
                codename: contentItem.codename
            });

            importedData.contentItems.push({
                original: parsedContentItem,
                imported: contentItem
            });

            return {
                contentItem: contentItem,
                status: 'itemAlreadyExists'
            };
        } catch (error) {
            if (is404Error(error)) {
                const contentItem = await managementClient
                    .addContentItem()
                    .withData({
                        name: parsedContentItem.system.name,
                        type: {
                            codename: parsedContentItem.system.type
                        },
                        codename: parsedContentItem.system.codename,
                        collection: {
                            codename: parsedContentItem.system.collection
                        }
                    })
                    .toPromise()
                    .then((m) => m.data);

                importedData.contentItems.push({
                    original: parsedContentItem,
                    imported: contentItem
                });

                logItemAction(this.logLevel, 'create', 'contentItem', {
                    title: `${contentItem.name}`,
                    codename: contentItem.codename
                });

                return {
                    contentItem: contentItem,
                    status: 'created'
                };
            }

            throw error;
        }
    }
}
