import { CollectionModels, ContentItemModels, ManagementClient } from '@kontent-ai/management-sdk';
import {
    Logger,
    processSetAsync,
    runMapiRequestAsync,
    MigrationItem,
    exitProgram,
    LogSpinnerData,
    isNotUndefined
} from '../../core/index.js';
import chalk from 'chalk';
import { ImportContext } from '../import.models.js';

export function contentItemsImporter(data: {
    readonly logger: Logger;
    readonly client: Readonly<ManagementClient>;
    readonly collections: readonly CollectionModels.Collection[];
    readonly importContext: ImportContext;
}) {
    const shouldUpdateContentItem = (
        migrationContentItem: MigrationItem,
        contentItem: Readonly<ContentItemModels.ContentItem>
    ): boolean => {
        const collection = data.collections.find((m) => m.codename === migrationContentItem.system.collection.codename);

        if (!collection) {
            exitProgram({
                message: `Invalid collection '${migrationContentItem.system.collection.codename}'`
            });
        }
        return (
            migrationContentItem.system.name !== contentItem.name ||
            migrationContentItem.system.collection.codename !== collection.codename
        );
    };

    const prepareContentItemAsync = async (
        logSpinner: LogSpinnerData,
        migrationContentItem: MigrationItem
    ): Promise<{ contentItem: Readonly<ContentItemModels.ContentItem>; status: 'created' | 'itemAlreadyExists' }> => {
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
                                codename: migrationContentItem.system.type.codename
                            },
                            external_id: itemStateInTargetEnv.externalIdToUse,
                            codename: migrationContentItem.system.codename,
                            collection: {
                                codename: migrationContentItem.system.collection.codename
                            }
                        })
                        .toPromise()
                ).data,
            action: 'create',
            type: 'contentItem',
            logSpinner: logSpinner,
            itemName: `${migrationContentItem.system.codename} (${migrationContentItem.system.language.codename})`
        });

        return {
            contentItem: createdContentItem,
            status: 'created'
        };
    };

    const importContentItemAsync = async (
        logSpinner: LogSpinnerData,
        migrationItem: MigrationItem
    ): Promise<Readonly<ContentItemModels.ContentItem>> => {
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
                                        codename: migrationItem.system.collection.codename
                                    }
                                })
                                .toPromise()
                        ).data,
                    action: 'upsert',
                    type: 'contentItem',
                    logSpinner: logSpinner,
                    itemName: `${migrationItem.system.codename} (${migrationItem.system.language.codename})`
                });
            }
        }

        return preparedContentItemResult.contentItem;
    };

    const importAsync = async (): Promise<readonly ContentItemModels.ContentItem[]> => {
        const contentItemsToImport = data.importContext.categorizedImportData.contentItems;

        data.logger.log({
            type: 'info',
            message: `Importing '${chalk.yellow(contentItemsToImport.length.toString())}' content items`
        });

        return (
            await processSetAsync<MigrationItem, ContentItemModels.ContentItem | undefined>({
                action: 'Importing content items',
                logger: data.logger,
                parallelLimit: 1,
                items: contentItemsToImport,
                itemInfo: (item) => {
                    return {
                        itemType: 'contentItem',
                        title: `${item.system.codename} -> ${item.system.language.codename}`
                    };
                },
                processAsync: async (item, logSpinner) => {
                    return await importContentItemAsync(logSpinner, item);
                }
            })
        ).filter(isNotUndefined);
    };

    return {
        importAsync
    };
}
