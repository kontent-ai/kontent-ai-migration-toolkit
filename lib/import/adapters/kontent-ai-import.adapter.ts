import {
    CollectionModels,
    ContentItemModels,
    ManagementClient,
    WorkflowModels,
    createManagementClient
} from '@kontent-ai/management-sdk';

import {
    defaultRetryStrategy,
    defaultHttpService,
    IMigrationItem,
    executeWithTrackingAsync
} from '../../core/index.js';
import { IImportAdapter, IKontentAiImportConfig, IImportContext, IImportData } from '../import.models.js';
import { ImportAssetsService, getImportAssetsService } from '../helper-services/import-assets.service.js';
import {
    ImportContentItemHelper,
    getImportContentItemService
} from '../helper-services/import-content-item.service.js';
import {
    ImportLanguageVariantServices,
    getImportLanguageVariantstemService
} from '../helper-services/import-language-variant.service.js';
import colors from 'colors';
import { libMetadata } from '../../metadata.js';
import { ImportContextService, getImportContextService } from './context/import-context.service.js';

export class KontentAiImportAdapter implements IImportAdapter {
    public readonly name: string = 'kontentAiImportAdapter';
    public readonly client: ManagementClient;

    private readonly importAssetsService: ImportAssetsService;
    private readonly importContentItemService: ImportContentItemHelper;
    private readonly importLanguageVariantService: ImportLanguageVariantServices;
    private readonly importContextService: ImportContextService;

    constructor(private config: IKontentAiImportConfig) {
        this.client = createManagementClient({
            apiKey: config.apiKey,
            baseUrl: config.baseUrl,
            environmentId: config.environmentId,
            httpService: defaultHttpService,
            retryStrategy: config.retryStrategy ?? defaultRetryStrategy
        });
        this.importAssetsService = getImportAssetsService(config.log, this.client);
        this.importContentItemService = getImportContentItemService({
            managementClient: this.client,
            log: config.log,
            skipFailedItems: config.skipFailedItems
        });
        this.importLanguageVariantService = getImportLanguageVariantstemService({
            managementClient: this.client,
            log: config.log,
            skipFailedItems: config.skipFailedItems
        });
        this.importContextService = getImportContextService(config.log, this.client);
    }

    getManagementClient(): ManagementClient {
        return this.client;
    }

    async importAsync(sourceData: IImportData): Promise<void> {
        await executeWithTrackingAsync({
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
                    itemsCount: sourceData.items.length,
                    assetsCount: sourceData.assets.length
                }
            },
            func: async () => {
                const dataToImport = this.filterDataToImport(sourceData);
                const importContext = await this.importContextService.getImportContextAsync(dataToImport);

                // import order matters
                // #1 Assets
                if (dataToImport.assets.length) {
                    await this.importAssetsService.importAssetsAsync({
                        assets: dataToImport.assets,
                        importContext: importContext
                    });
                } else {
                    this.config.log.console({
                        type: 'info',
                        message: `There are no assets to import`
                    });
                }

                // #2 Content items
                if (dataToImport.items.length) {
                    await this.importMigrationItemsAsync(dataToImport.items, importContext);
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
            }
        });
    }

    private filterDataToImport(source: IImportData): IImportData {
        const dataToImport: IImportData = {
            assets: [],
            items: []
        };

        let removedAssets: number = 0;
        let removedContentItems: number = 0;

        if (this.config?.canImport?.asset) {
            for (const asset of source.assets) {
                const canImport = this.config.canImport.asset(asset);
                if (canImport) {
                    dataToImport.assets.push(asset);
                } else {
                    removedAssets++;
                }
            }
        } else {
            dataToImport.assets = source.assets;
        }

        if (this.config?.canImport?.contentItem) {
            for (const item of source.items) {
                const canImport = this.config.canImport.contentItem(item);
                if (canImport) {
                    dataToImport.items.push(item);
                } else {
                    removedContentItems++;
                }
            }
        } else {
            dataToImport.items = source.items;
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

        // first prepare all content items
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
        return await this.client
            .listWorkflows()
            .toPromise()
            .then((m) => m.data);
    }

    private async getCollectionsAsync(): Promise<CollectionModels.Collection[]> {
        return await this.client
            .listCollections()
            .toPromise()
            .then((m) => m.data.collections);
    }
}
