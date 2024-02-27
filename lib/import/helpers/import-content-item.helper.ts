import { CollectionModels, ContentItemModels, ManagementClient } from '@kontent-ai/management-sdk';
import {
    IImportedData,
    extractErrorData,
    is404Error,
    logItemAction,
    logDebug,
    logErrorAndExit,
    processInChunksAsync,
    LogLevel,
    ContentItemsFetchMode,
    IMigrationItem
} from '../../core/index.js';
import { ICategorizedParsedItems, parsedItemsHelper } from './parsed-items-helper.js';
import colors from 'colors';

export function getImportContentItemHelper(config: {
    logLevel: LogLevel;
    skipFailedItems: boolean;
    fetchMode: ContentItemsFetchMode;
}): ImportContentItemHelper {
    return new ImportContentItemHelper(config.logLevel, config.skipFailedItems, config.fetchMode);
}

export class ImportContentItemHelper {
    private readonly importContentItemChunkSize: number = 3;

    constructor(
        private readonly logLevel: LogLevel,
        private readonly skipFailedItems: boolean,
        private readonly fetchMode: ContentItemsFetchMode
    ) {}

    async importContentItemsAsync(data: {
        managementClient: ManagementClient;
        migrationContentItems: IMigrationItem[];
        collections: CollectionModels.Collection[];
        importedData: IImportedData;
    }): Promise<ContentItemModels.ContentItem[]> {
        const categorizedParsedItems: ICategorizedParsedItems = parsedItemsHelper.categorizeParsedItems(
            data.migrationContentItems
        );

        logItemAction(this.logLevel, 'skip', 'contentItem', {
            title: `Skipping '${colors.yellow(
                categorizedParsedItems.componentItems.length.toString()
            )}' because they represent component items`
        });

        let fetchedContentItems: ContentItemModels.ContentItem[] = [];

        logDebug({
            message: `Fetching items via '${colors.yellow(this.fetchMode)}' mode`,
            type: 'info'
        });

        if (this.fetchMode === 'oneByOne') {
            fetchedContentItems = await this.fetchContentItemsOneByOneAsync({
                categorizedParsedItems: categorizedParsedItems,
                managementClient: data.managementClient
            });
        } else {
            fetchedContentItems = await this.fetchAllContentItemsAsync({ managementClient: data.managementClient });
        }

        const preparedItems: ContentItemModels.ContentItem[] = [];

        for (const parsedItem of data.migrationContentItems) {
            if (!parsedItem.system.workflow || !parsedItem.system.workflow_step) {
                // items without workflow or workflow step are components and they should not be imported individually
                continue;
            }

            try {
                const contentItem = await this.importContentItemAsync({
                    managementClient: data.managementClient,
                    collections: data.collections,
                    importContentItem: parsedItem,
                    importedData: data.importedData,
                    migrationContentItems: data.migrationContentItems,
                    fetchedContentItems: fetchedContentItems
                });

                preparedItems.push(contentItem);
            } catch (error) {
                if (this.skipFailedItems) {
                    logDebug({
                        type: 'error',
                        message: `Failed to import content item`,
                        partA: parsedItem.system.codename,
                        partB: extractErrorData(error).message
                    });
                } else {
                    throw error;
                }
            }
        }

        return preparedItems;
    }

    private async fetchContentItemsOneByOneAsync(data: {
        managementClient: ManagementClient;
        categorizedParsedItems: ICategorizedParsedItems;
    }): Promise<ContentItemModels.ContentItem[]> {
        const contentItems: ContentItemModels.ContentItem[] = [];

        await processInChunksAsync<IMigrationItem, void>({
            chunkSize: this.importContentItemChunkSize,
            items: data.categorizedParsedItems.regularItems,
            itemInfo: (input) => {
                return {
                    itemType: 'contentItem',
                    title: input.system.name,
                    partA: input.system.type
                };
            },
            processFunc: async (migrationContentItem) => {
                try {
                    logItemAction(this.logLevel, 'fetch', 'contentItem', {
                        title: `${migrationContentItem.system.name}`,
                        codename: migrationContentItem.system.codename
                    });
                    const contentItem = await data.managementClient
                        .viewContentItem()
                        .byItemCodename(migrationContentItem.system.codename)
                        .toPromise()
                        .then((m) => m.data);

                    contentItems.push(contentItem);
                } catch (error) {
                    if (!is404Error(error)) {
                        throw error;
                    }
                }
            }
        });

        return contentItems;
    }

    private async fetchAllContentItemsAsync(data: {
        managementClient: ManagementClient;
    }): Promise<ContentItemModels.ContentItem[]> {
        return (
            await data.managementClient
                .listContentItems()
                .withListQueryConfig({
                    responseFetched: (response, token) => {
                        logItemAction(this.logLevel, 'fetch', 'listContentItems', {
                            title: `Fetched '${colors.yellow(response.data.items.length.toString())}' items`
                        });
                    }
                })
                .toAllPromise()
        ).data.items;
    }

    private async importContentItemAsync(data: {
        importContentItem: IMigrationItem;
        managementClient: ManagementClient;
        migrationContentItems: IMigrationItem[];
        collections: CollectionModels.Collection[];
        importedData: IImportedData;
        fetchedContentItems: ContentItemModels.ContentItem[];
    }): Promise<ContentItemModels.ContentItem> {
        const preparedContentItemResult = await this.prepareContentItemAsync(
            data.managementClient,
            data.importContentItem,
            data.fetchedContentItems
        );

        data.importedData.contentItems.push({
            original: data.importContentItem,
            imported: preparedContentItemResult.contentItem
        });

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
            }
        }

        return preparedContentItemResult.contentItem;
    }

    private shouldUpdateContentItem(
        migrationContentItem: IMigrationItem,
        contentItem: ContentItemModels.ContentItem,
        collections: CollectionModels.Collection[]
    ): boolean {
        const collection = collections.find((m) => m.codename === migrationContentItem.system.collection);

        if (!collection) {
            logErrorAndExit({
                message: `Invalid collection '${migrationContentItem.system.collection}'`
            });
        }
        return (
            migrationContentItem.system.name !== contentItem.name ||
            migrationContentItem.system.collection !== collection.codename
        );
    }

    private async prepareContentItemAsync(
        managementClient: ManagementClient,
        migrationContentItem: IMigrationItem,
        fetchedContentItems: ContentItemModels.ContentItem[]
    ): Promise<{ contentItem: ContentItemModels.ContentItem; status: 'created' | 'itemAlreadyExists' }> {
        const contentItem = fetchedContentItems.find((m) => m.codename === migrationContentItem.system.codename);

        if (contentItem) {
            return {
                contentItem: contentItem,
                status: 'itemAlreadyExists'
            };
        }
        const createdContentItem = await managementClient
            .addContentItem()
            .withData({
                name: migrationContentItem.system.name,
                type: {
                    codename: migrationContentItem.system.type
                },
                codename: migrationContentItem.system.codename,
                collection: {
                    codename: migrationContentItem.system.collection
                }
            })
            .toPromise()
            .then((m) => m.data);

        return {
            contentItem: createdContentItem,
            status: 'created'
        };
    }
}
