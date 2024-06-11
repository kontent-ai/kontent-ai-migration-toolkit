import { CollectionModels, ContentItemModels, ManagementClient } from '@kontent-ai/management-sdk';
import {
    extractErrorData,
    logErrorAndExit,
    MigrationItem,
    Logger,
    runMapiRequestAsync,
    processInChunksAsync,
    LogSpinnerData
} from '../../core/index.js';
import chalk from 'chalk';
import { ImportContext } from '../import.models.js';

export function getImportContentItemService(config: {
    logger: Logger;
    skipFailedItems: boolean;
    managementClient: ManagementClient;
}): ImportContentItemHelper {
    return new ImportContentItemHelper(config);
}

export class ImportContentItemHelper {
    constructor(
        private readonly config: { logger: Logger; skipFailedItems: boolean; managementClient: ManagementClient }
    ) {}

    async importContentItemsAsync(data: {
        collections: CollectionModels.Collection[];
        importContext: ImportContext;
    }): Promise<ContentItemModels.ContentItem[]> {
        const preparedItems: ContentItemModels.ContentItem[] = [];
        const preparedItemsWithoutComponents = data.importContext.contentItems.filter((m) => {
            if (!m.system.workflow || !m.system.workflow_step) {
                // items without workflow or workflow step are components and they should not be imported individually
                return false;
            }
            return true;
        });

        this.config.logger.log({
            type: 'info',
            message: `Importing '${chalk.yellow(preparedItemsWithoutComponents.length.toString())}' content items`
        });

        await processInChunksAsync<MigrationItem, void>({
            logger: this.config.logger,
            chunkSize: 1,
            items: preparedItemsWithoutComponents,
            itemInfo: (item) => {
                return {
                    itemType: 'contentItem',
                    title: `${item.system.codename} -> ${item.system.language}`
                };
            },
            processAsync: async (item, logSpinner) => {
                if (!item.system.workflow || !item.system.workflow_step) {
                    // items without workflow or workflow step are components and they should not be imported individually
                    return;
                }

                try {
                    const contentItem = await this.importContentItemAsync({
                        logSpinner: logSpinner,
                        managementClient: this.config.managementClient,
                        collections: data.collections,
                        migrationItem: item,
                        importContext: data.importContext
                    });

                    preparedItems.push(contentItem);
                } catch (error) {
                    if (this.config.skipFailedItems) {
                        this.config.logger.log({
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
    }

    private async importContentItemAsync(data: {
        logSpinner: LogSpinnerData;
        migrationItem: MigrationItem;
        managementClient: ManagementClient;
        collections: CollectionModels.Collection[];
        importContext: ImportContext;
    }): Promise<ContentItemModels.ContentItem> {
        const preparedContentItemResult = await this.prepareContentItemAsync(
            data.logSpinner,
            data.managementClient,
            data.migrationItem,
            data.importContext
        );

        // check if name should be updated, no other changes are supported
        if (preparedContentItemResult.status === 'itemAlreadyExists') {
            if (
                this.shouldUpdateContentItem(
                    data.migrationItem,
                    preparedContentItemResult.contentItem,
                    data.collections
                )
            ) {
                await runMapiRequestAsync({
                    logger: this.config.logger,
                    func: async () =>
                        (
                            await data.managementClient
                                .upsertContentItem()
                                .byItemCodename(data.migrationItem.system.codename)
                                .withData({
                                    name: data.migrationItem.system.name,
                                    collection: {
                                        codename: data.migrationItem.system.collection
                                    }
                                })
                                .toPromise()
                        ).data,
                    action: 'upsert',
                    type: 'contentItem',
                    logSpinner: data.logSpinner,
                    itemName: `${data.migrationItem.system.codename} (${data.migrationItem.system.language})`
                });
            }
        }

        return preparedContentItemResult.contentItem;
    }

    private shouldUpdateContentItem(
        migrationContentItem: MigrationItem,
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
        logSpinner: LogSpinnerData,
        managementClient: ManagementClient,
        migrationContentItem: MigrationItem,
        context: ImportContext
    ): Promise<{ contentItem: ContentItemModels.ContentItem; status: 'created' | 'itemAlreadyExists' }> {
        const itemStateInTargetEnv = context.getItemStateInTargetEnvironment(migrationContentItem.system.codename);

        if (itemStateInTargetEnv.state === 'exists' && itemStateInTargetEnv.item) {
            return {
                contentItem: itemStateInTargetEnv.item,
                status: 'itemAlreadyExists'
            };
        }

        const createdContentItem = await runMapiRequestAsync({
            logger: this.config.logger,
            func: async () =>
                (
                    await managementClient
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
    }
}
