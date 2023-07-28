import { CollectionModels, ContentItemModels, ManagementClient } from '@kontent-ai/management-sdk';
import { IImportedData, logAction, extractErrorMessage, is404Error } from '../../core';
import { logDebug } from '../../core/log-helper';
import { IParsedContentItem } from '../import.models';

export class ImportContentItemHelper {
    async importContentItemsAsync(
        managementClient: ManagementClient,
        parsedContentItems: IParsedContentItem[],
        collections: CollectionModels.Collection[],
        importedData: IImportedData,
        config: {
            skipFailedItems: boolean;
        }
    ): Promise<ContentItemModels.ContentItem[]> {
        const preparedItems: ContentItemModels.ContentItem[] = [];
        for (const importContentItem of parsedContentItems) {
            try {
                if (!importContentItem.system.workflow_step) {
                    continue;
                }

                const preparedContentItem: ContentItemModels.ContentItem = await this.prepareContentItemAsync(
                    managementClient,
                    importContentItem,
                    importedData
                );
                preparedItems.push(preparedContentItem);

                // check if name should be updated, no other changes are supported
                if (this.shouldUpdateContentItem(importContentItem, preparedContentItem, collections)) {
                    const upsertedContentItem = await managementClient
                        .upsertContentItem()
                        .byItemCodename(importContentItem.system.codename)
                        .withData({
                            name: importContentItem.system.name,
                            collection: {
                                codename: importContentItem.system.collection
                            }
                        })
                        .toPromise()
                        .then((m) => m.data);

                    logAction('upsert', 'contentItem', {
                        title: `${upsertedContentItem.name}`
                    });
                } else {
                    logAction('skipUpdate', 'contentItem', {
                        title: `${importContentItem.system.name}`
                    });
                }
            } catch (error) {
                if (config.skipFailedItems) {
                    logDebug(
                        'error',
                        `Failed to import content item`,
                        importContentItem.system.codename,
                        extractErrorMessage(error)
                    );
                } else {
                    throw error;
                }
            }
        }

        return preparedItems;
    }

    private shouldUpdateContentItem(
        parsedContentItem: IParsedContentItem,
        contentItem: ContentItemModels.ContentItem,
        collections: CollectionModels.Collection[]
    ): boolean {
        const collection = collections.find((m) => m.codename === parsedContentItem.system.collection);

        if (!collection) {
            throw Error(`Invalid collection '${parsedContentItem.system.collection}'`);
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
    ): Promise<ContentItemModels.ContentItem> {
        try {
            const contentItem = await managementClient
                .viewContentItem()
                .byItemCodename(parsedContentItem.system.codename)
                .toPromise()
                .then((m) => m.data);

            logAction('fetch', 'contentItem', {
                title: `${contentItem.name}`
            });

            importedData.contentItems.push({
                original: parsedContentItem,
                imported: contentItem
            });

            return contentItem;
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

                logAction('create', 'contentItem', {
                    title: `${contentItem.name}`
                });

                return contentItem;
            }

            throw error;
        }
    }
}

export const importContentItemHelper = new ImportContentItemHelper();
