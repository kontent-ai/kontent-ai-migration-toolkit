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
        let itemIndex: number = 0;
        for (const importContentItem of parsedContentItems) {
            itemIndex++;

            logDebug({
                type: 'info',
                processingIndex: {
                    index: itemIndex,
                    totalCount: parsedContentItems.length
                },
                message: `Processing content item '${importContentItem.system.name}'`,
                partA: importContentItem.system.codename
            });

            // if content item does not have a workflow step it means it is used as a component within Rich text element
            // such items are procesed within element transform
            if (!importContentItem.system.workflow_step) {
                logAction('skip', 'contentItem', {
                    title: `Skipping item beause it's a component`,
                    codename: importContentItem.system.codename
                });
                continue;
            }

            try {
                const preparedContentItemResult = await this.prepareContentItemAsync(
                    managementClient,
                    importContentItem,
                    importedData
                );
                preparedItems.push(preparedContentItemResult.contentItem);

                // check if name should be updated, no other changes are supported
                if (preparedContentItemResult.status === 'itemAlreadyExists') {
                    if (
                        this.shouldUpdateContentItem(
                            importContentItem,
                            preparedContentItemResult.contentItem,
                            collections
                        )
                    ) {
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
                            title: `Upserting item '${upsertedContentItem.name}'`,
                            codename: importContentItem.system.codename
                        });
                    } else {
                        logAction('skip', 'contentItem', {
                            title: `item '${importContentItem.system.name}' already exists`,
                            codename: importContentItem.system.codename
                        });
                    }
                }
            } catch (error) {
                if (config.skipFailedItems) {
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
    ): Promise<{ contentItem: ContentItemModels.ContentItem; status: 'created' | 'itemAlreadyExists' }> {
        try {
            const contentItem = await managementClient
                .viewContentItem()
                .byItemCodename(parsedContentItem.system.codename)
                .toPromise()
                .then((m) => m.data);

            logAction('fetch', 'contentItem', {
                title: `Loading item '${contentItem.name}'`,
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

                logAction('create', 'contentItem', {
                    title: `Creating item '${contentItem.name}'`,
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

export const importContentItemHelper = new ImportContentItemHelper();
