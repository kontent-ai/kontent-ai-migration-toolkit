import { CollectionModels, ContentItemModels, ManagementClient } from '@kontent-ai/management-sdk';
import {
    IImportContext,
    extractErrorData,
    is404Error,
    logErrorAndExit,
    processInChunksAsync,
    IMigrationItem,
    Log,
    getItemExternalIdForCodename
} from '../../core/index.js';
import colors from 'colors';

export function getImportContentItemHelper(config: { log: Log; skipFailedItems: boolean }): ImportContentItemHelper {
    return new ImportContentItemHelper(config.log, config.skipFailedItems);
}

export class ImportContentItemHelper {
    private readonly importContentItemChunkSize: number = 1;

    constructor(private readonly log: Log, private readonly skipFailedItems: boolean) {}

    async getContentItemsByCodenamesAsync(data: {
        managementClient: ManagementClient;
        itemCodenames: string[];
    }): Promise<ContentItemModels.ContentItem[]> {
        const contentItems: ContentItemModels.ContentItem[] = [];

        await processInChunksAsync<string, void>({
            log: this.log,
            type: 'contentItem',
            chunkSize: this.importContentItemChunkSize,
            items: data.itemCodenames,
            itemInfo: (codename) => {
                return {
                    itemType: 'contentItem',
                    title: codename
                };
            },
            processFunc: async (codename) => {
                try {
                    this.log.spinner?.text?.({
                        type: 'fetch',
                        message: `${codename}`
                    });

                    const contentItem = await data.managementClient
                        .viewContentItem()
                        .byItemCodename(codename)
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

    async importContentItemsAsync(data: {
        managementClient: ManagementClient;
        collections: CollectionModels.Collection[];
        importContext: IImportContext;
    }): Promise<ContentItemModels.ContentItem[]> {
        const preparedItems: ContentItemModels.ContentItem[] = [];

        this.log.console({
            type: 'info',
            message: `Importing '${colors.yellow(
                data.importContext.categorizedItems.contentItems.length.toString()
            )}' content items`
        });

        for (const parsedItem of data.importContext.categorizedItems.contentItems) {
            if (!parsedItem.system.workflow || !parsedItem.system.workflow_step) {
                // items without workflow or workflow step are components and they should not be imported individually
                continue;
            }

            try {
                const contentItem = await this.importContentItemAsync({
                    managementClient: data.managementClient,
                    collections: data.collections,
                    importContentItem: parsedItem,
                    importContext: data.importContext
                });

                preparedItems.push(contentItem);
            } catch (error) {
                if (this.skipFailedItems) {
                    this.log.console({
                        type: 'error',
                        message: `Failed to import content item '${parsedItem.system.name}'. ${
                            extractErrorData(error).message
                        }`
                    });
                } else {
                    throw error;
                }
            }
        }

        return preparedItems;
    }

    private async importContentItemAsync(data: {
        importContentItem: IMigrationItem;
        managementClient: ManagementClient;
        collections: CollectionModels.Collection[];
        importContext: IImportContext;
    }): Promise<ContentItemModels.ContentItem> {
        const preparedContentItemResult = await this.prepareContentItemAsync(
            data.managementClient,
            data.importContentItem,
            data.importContext
        );

        data.importContext.importedContentItems.push({
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
                this.log.spinner?.text?.({
                    type: 'upsert',
                    message: `${data.importContentItem.system.name}`
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
        context: IImportContext
    ): Promise<{ contentItem: ContentItemModels.ContentItem; status: 'created' | 'itemAlreadyExists' }> {
        const itemStateInTargetEnv = context.categorizedItems.getItemStateInTargetEnvironment(
            migrationContentItem.system.codename
        );

        if (itemStateInTargetEnv.state === 'exists' && itemStateInTargetEnv.item) {
            return {
                contentItem: itemStateInTargetEnv.item,
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
                external_id: getItemExternalIdForCodename(migrationContentItem.system.codename),
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
