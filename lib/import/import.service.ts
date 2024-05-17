import {
    CollectionModels,
    ContentItemModels,
    ManagementClient,
    WorkflowModels,
    createManagementClient
} from '@kontent-ai/management-sdk';

import { defaultRetryStrategy, defaultHttpService, IMigrationItem, executeWithTrackingAsync } from '../core/index.js';
import { IImportConfig, IImportContext, IImportSource } from './import.models.js';
import { ImportAssetsService, getImportAssetsService } from './helper-services/import-assets.service.js';
import { ImportContentItemHelper, getImportContentItemService } from './helper-services/import-content-item.service.js';
import {
    ImportLanguageVariantServices,
    getImportLanguageVariantstemService
} from './helper-services/import-language-variant.service.js';
import colors from 'colors';
import { libMetadata } from '../metadata.js';
import { ImportContextService, getImportContextService } from './context/import-context.service.js';

export class ImportService {
    public readonly managementClient: ManagementClient;
    private readonly importAssetsService: ImportAssetsService;
    private readonly importContentItemService: ImportContentItemHelper;
    private readonly importLanguageVariantService: ImportLanguageVariantServices;
    private readonly importContextService: ImportContextService;

    constructor(private config: IImportConfig) {
        this.managementClient = createManagementClient({
            apiKey: config.managementApiKey,
            baseUrl: config.baseUrl,
            environmentId: config.environmentId,
            httpService: defaultHttpService,
            retryStrategy: config.retryStrategy ?? defaultRetryStrategy
        });

        this.importAssetsService = getImportAssetsService(config.log, this.managementClient);
        this.importContentItemService = getImportContentItemService({
            managementClient: this.managementClient,
            log: config.log,
            skipFailedItems: config.skipFailedItems
        });
        this.importLanguageVariantService = getImportLanguageVariantstemService({
            managementClient: this.managementClient,
            log: config.log,
            skipFailedItems: config.skipFailedItems
        });
        this.importContextService = getImportContextService(config.log, this.managementClient);
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

                const importContext = await this.importContextService.getImportContextAsync(dataToImport.importData);

                // import order matters
                // #1 Assets
                if (dataToImport.importData.assets.length) {
                    await this.importAssetsService.importAssetsAsync({
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
            await this.importContentItemService.importContentItemsAsync({
                collections: collections,
                importContext: importContext
            });

        // then process language variants
        await this.importLanguageVariantService.importLanguageVariantsAsync({
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
