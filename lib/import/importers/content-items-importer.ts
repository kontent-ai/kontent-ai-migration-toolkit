import { CollectionModels, ContentItemModels, ManagementClient } from '@kontent-ai/management-sdk';
import {
    Logger,
    processInChunksAsync,
    runMapiRequestAsync,
    MigrationItem,
    extractErrorData,
    logErrorAndExit,
    LogSpinnerData
} from '../../core/index.js';
import chalk from 'chalk';
import { ImportContext } from '../import.models.js';

export function contentItemsImporter(data: {
    readonly logger: Logger;
    readonly client: ManagementClient;
    readonly skipFailedItems: boolean;
    readonly collections: CollectionModels.Collection[];
    readonly importContext: ImportContext;
}) {
    const shouldUpdateContentItem = (
        migrationContentItem: MigrationItem,
        contentItem: ContentItemModels.ContentItem
    ) => {
        const collection = data.collections.find((m) => m.codename === migrationContentItem.system.collection);

        if (!collection) {
            logErrorAndExit({
                message: `Invalid collection '${migrationContentItem.system.collection}'`
            });
        }
        return (
            migrationContentItem.system.name !== contentItem.name ||
            migrationContentItem.system.collection !== collection.codename
        );
    };

    const prepareContentItemAsync: (
        logSpinner: LogSpinnerData,
        migrationContentItem: MigrationItem
    ) => Promise<{ contentItem: ContentItemModels.ContentItem; status: 'created' | 'itemAlreadyExists' }> = async (
        logSpinner,
        migrationContentItem
    ) => {
        const itemStateInTargetEnv = data.importContext.getItemStateInTargetEnvironment(
            migrationContentItem.system.codename
        );

        if (itemStateInTargetEnv.state === 'exists' && itemStateInTargetEnv.item) {
            return {
                contentItem: itemStateInTargetEnv.item,
                status: 'itemAlreadyExists'
            };
        }

        const createdContentItem = await runMapiRequestAsync({
            logger: data.logger,
            func: async () =>
                (
                    await data.client
                        .addContentItem()
                        .withData({
                            name: migrationContentItem.system.name,
                            type: {
                                codename: migrationContentItem.system.type
                            },
                            external_id: itemStateInTargetEnv.externalIdToUse,
                            codename: migrationContentItem.system.codename,
                            collection: {
                                codename: migrationContentItem.system.collection
                            }
                        })
                        .toPromise()
                ).data,
            action: 'create',
            type: 'contentItem',
            logSpinner: logSpinner,
            itemName: `${migrationContentItem.system.codename} (${migrationContentItem.system.language})`
        });

        return {
            contentItem: createdContentItem,
            status: 'created'
        };
    };

    const importContentItemAsync = async (
        logSpinner: LogSpinnerData,
        migrationItem: MigrationItem
    ): Promise<ContentItemModels.ContentItem> => {
        const preparedContentItemResult = await prepareContentItemAsync(logSpinner, migrationItem);

        // check if name should be updated, no other changes are supported
        if (preparedContentItemResult.status === 'itemAlreadyExists') {
            if (shouldUpdateContentItem(migrationItem, preparedContentItemResult.contentItem)) {
                await runMapiRequestAsync({
                    logger: data.logger,
                    func: async () =>
                        (
                            await data.client
                                .upsertContentItem()
                                .byItemCodename(migrationItem.system.codename)
                                .withData({
                                    name: migrationItem.system.name,
                                    collection: {
                                        codename: migrationItem.system.collection
                                    }
                                })
                                .toPromise()
                        ).data,
                    action: 'upsert',
                    type: 'contentItem',
                    logSpinner: logSpinner,
                    itemName: `${migrationItem.system.codename} (${migrationItem.system.language})`
                });
            }
        }

        return preparedContentItemResult.contentItem;
    };

    const importAsync = async () => {
        const preparedItems: ContentItemModels.ContentItem[] = [];
        const contentItemsToImport = data.importContext.contentItems;

        data.logger.log({
            type: 'info',
            message: `Importing '${chalk.yellow(contentItemsToImport.length.toString())}' content items`
        });

        await processInChunksAsync<MigrationItem, void>({
            logger: data.logger,
            chunkSize: 1,
            items: contentItemsToImport,
            itemInfo: (item) => {
                return {
                    itemType: 'contentItem',
                    title: `${item.system.codename} -> ${item.system.language}`
                };
            },
            processAsync: async (item, logSpinner) => {
                try {
                    preparedItems.push(await importContentItemAsync(logSpinner, item));
                } catch (error) {
                    if (data.skipFailedItems) {
                        data.logger.log({
                            type: 'error',
                            message: `Failed to import content item '${item.system.name}'. ${
                                extractErrorData(error).message
                            }`
                        });
                    } else {
                        throw error;
                    }
                }
            }
        });

        return preparedItems;
    };

    return {
        importAsync
    };
}
