import {
    CollectionModels,
    ContentItemModels,
    ManagementClient,
    WorkflowModels,
    createManagementClient
} from '@kontent-ai/management-sdk';

import {
    IImportContext,
    defaultRetryStrategy,
    defaultHttpService,
    IMigrationItem,
    executeWithTrackingAsync
} from '../core/index.js';
import { IImportConfig, IImportSource } from './import.models.js';
import { ImportAssetsHelper, getImportAssetsHelper } from './helpers/import-assets.helper.js';
import { ImportContentItemHelper, getImportContentItemHelper } from './helpers/import-content-item.helper.js';
import {
    ImportLanguageVariantHelper,
    getImportLanguageVariantstemHelper
} from './helpers/import-language-variant.helper.js';
import colors from 'colors';
import { libMetadata } from '../metadata.js';
import { ImportContextHelper, getImportContextHelper } from './helpers/import-context-helper.js';

export class ImportService {
    public readonly managementClient: ManagementClient;
    private readonly importAssetsHelper: ImportAssetsHelper;
    private readonly importContentItemHelper: ImportContentItemHelper;
    private readonly importLanguageVariantHelper: ImportLanguageVariantHelper;
    private readonly importContextHelper: ImportContextHelper;

    constructor(private config: IImportConfig) {
        this.managementClient = createManagementClient({
            apiKey: config.managementApiKey,
            baseUrl: config.baseUrl,
            environmentId: config.environmentId,
            httpService: defaultHttpService,
            retryStrategy: config.retryStrategy ?? defaultRetryStrategy
        });

        this.importAssetsHelper = getImportAssetsHelper(config.log);
        this.importContentItemHelper = getImportContentItemHelper({
            log: config.log,
            skipFailedItems: config.skipFailedItems
        });
        this.importLanguageVariantHelper = getImportLanguageVariantstemHelper({
            log: config.log,
            skipFailedItems: config.skipFailedItems
        });
        this.importContextHelper = getImportContextHelper(config.log, this.managementClient);
    }

    async importAsync(sourceData: IImportSource): Promise<IImportContext> {
        return await executeWithTrackingAsync({
            event: {
                tool: 'migrationToolkit',
                package: {
                    name: libMetadata.name,
                    version: libMetadata.version
                },
                action: 'import',
                relatedEnvironmentId: this.config.environmentId,
                details: {
                    skipFailedItems: this.config.skipFailedItems,
                    itemsCount: sourceData.importData.items.length,
                    assetsCount: sourceData.importData.assets.length
                }
            },
            func: async () => {
                // this is an optional step where users can exclude certain objects from being imported
                const dataToImport = this.getDataToImport(sourceData);

                const importContext = await this.importContextHelper.getImportContextAsync(dataToImport.importData);

                // import order matters
                // #1 Assets
                if (dataToImport.importData.assets.length) {
                    await this.importAssetsHelper.importAssetsAsync({
                        managementClient: this.managementClient,
                        assets: dataToImport.importData.assets,
                        importContext: importContext
                    });
                } else {
                    this.config.log.console({
                        type: 'info',
                        message: `There are no assets to import`
                    });
                }

                // #2 Content items
                if (dataToImport.importData.items.length) {
                    await this.importMigrationItemsAsync(dataToImport.importData.items, importContext);
                } else {
                    this.config.log.console({
                        type: 'info',
                        message: `There are no content items to import`
                    });
                }

                this.config.log.console({
                    type: 'info',
                    message: `Finished import`
                });

                return importContext;
            }
        });
    }

    private getDataToImport(source: IImportSource): IImportSource {
        const dataToImport: IImportSource = {
            importData: {
                assets: [],
                items: []
            }
        };

        let removedAssets: number = 0;
        let removedContentItems: number = 0;

        if (this.config?.canImport?.asset) {
            for (const asset of source.importData.assets) {
                const canImport = this.config.canImport.asset(asset);
                if (canImport) {
                    dataToImport.importData.assets.push(asset);
                } else {
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
                } else {
                    removedContentItems++;
                }
            }
        } else {
            dataToImport.importData.items = source.importData.items;
        }

        if (removedAssets > 0) {
            this.config.log.console({
                type: 'info',
                message: `Removed '${colors.yellow(removedAssets.toString())}' assets from import`
            });
        }

        if (removedContentItems) {
            this.config.log.console({
                type: 'info',
                message: `Removed '${colors.yellow(removedContentItems.toString())}' content items from import`
            });
        }

        return dataToImport;
    }

    private async importMigrationItemsAsync(
        migrationContentItems: IMigrationItem[],
        importContext: IImportContext
    ): Promise<void> {
        const workflows = await this.getWorkflowsAsync();
        const collections = await this.getCollectionsAsync();

        // first prepare content items
        const preparedContentItems: ContentItemModels.ContentItem[] =
            await this.importContentItemHelper.importContentItemsAsync({
                managementClient: this.managementClient,
                collections: collections,
                importContext: importContext
            });

        // then process language variants
        await this.importLanguageVariantHelper.importLanguageVariantsAsync({
            managementClient: this.managementClient,
            importContentItems: migrationContentItems,
            importContext: importContext,
            preparedContentItems: preparedContentItems,
            workflows: workflows
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
