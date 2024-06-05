import { CollectionModels, ContentItemModels, ManagementClient } from '@kontent-ai/management-sdk';
import { extractErrorData, logErrorAndExit, IMigrationItem, Log, runMapiRequestAsync } from '../../core/index.js';
import chalk from 'chalk';
import { IImportContext } from '../import.models.js';

export function getImportContentItemService(config: {
    log: Log;
    skipFailedItems: boolean;
    managementClient: ManagementClient;
}): ImportContentItemHelper {
    return new ImportContentItemHelper(config);
}

export class ImportContentItemHelper {
    constructor(private readonly config: { log: Log; skipFailedItems: boolean; managementClient: ManagementClient }) {}

    async importContentItemsAsync(data: {
        collections: CollectionModels.Collection[];
        importContext: IImportContext;
    }): Promise<ContentItemModels.ContentItem[]> {
        const preparedItems: ContentItemModels.ContentItem[] = [];

        this.config.log.logger({
            type: 'info',
            message: `Importing '${chalk.yellow(data.importContext.contentItems.length.toString())}' content items`
        });

        for (const parsedItem of data.importContext.contentItems) {
            if (!parsedItem.system.workflow || !parsedItem.system.workflow_step) {
                // items without workflow or workflow step are components and they should not be imported individually
                continue;
            }

            try {
                const contentItem = await this.importContentItemAsync({
                    managementClient: this.config.managementClient,
                    collections: data.collections,
                    migrationItem: parsedItem,
                    importContext: data.importContext
                });

                preparedItems.push(contentItem);
            } catch (error) {
                if (this.config.skipFailedItems) {
                    this.config.log.logger({
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
        migrationItem: IMigrationItem;
        managementClient: ManagementClient;
        collections: CollectionModels.Collection[];
        importContext: IImportContext;
    }): Promise<ContentItemModels.ContentItem> {
        const preparedContentItemResult = await this.prepareContentItemAsync(
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
                    log: this.config.log,
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
                    useSpinner: true,
                    itemName: `${data.migrationItem.system.codename} (${data.migrationItem.system.language})`
                });
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
        const itemStateInTargetEnv = context.getItemStateInTargetEnvironment(migrationContentItem.system.codename);

        if (itemStateInTargetEnv.state === 'exists' && itemStateInTargetEnv.item) {
            return {
                contentItem: itemStateInTargetEnv.item,
                status: 'itemAlreadyExists'
            };
        }

        const createdContentItem = await runMapiRequestAsync({
            log: this.config.log,
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
            useSpinner: true,
            itemName: `${migrationContentItem.system.codename} (${migrationContentItem.system.language})`
        });

        return {
            contentItem: createdContentItem,
            status: 'created'
        };
    }
}
