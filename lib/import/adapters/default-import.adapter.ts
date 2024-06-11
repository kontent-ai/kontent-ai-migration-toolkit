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
    runMapiRequestAsync,
    defaultExternalIdGenerator
} from '../../core/index.js';
import { DefaultImportAdapterConfig, ImportAdapter, ImportContext, ImportData } from '../import.models.js';
import { assetsImporter } from '../importers/assets-importer.js';
import { contentItemsImporter } from '../importers/content-items-importer.js';
import { languageVariantImporter } from '../importers/language-variant-importer.js';
import { importContextFetcher } from '../context/import-context-fetcher.js';

export class DefaultImportAdapter implements ImportAdapter {
    public readonly name: string = 'Kontent.ai import adapter';
    public readonly targetEnvironmentClient: ManagementClient;

    constructor(private readonly config: DefaultImportAdapterConfig) {
        this.targetEnvironmentClient = createManagementClient({
            apiKey: config.apiKey,
            baseUrl: config.baseUrl,
            environmentId: config.environmentId,
            httpService: defaultHttpService,
            retryStrategy: config.retryStrategy ?? defaultRetryStrategy
        });
    }

    async importAsync(importData: ImportData): Promise<void> {
        const importContext = await importContextFetcher({
            importData: importData,
            externalIdGenerator: this.config.externalIdGenerator ?? defaultExternalIdGenerator,
            logger: this.config.logger,
            managementClient: this.targetEnvironmentClient
        }).getImportContextAsync();

        // Import order matters
        // #1 Assets
        await this.importAssetsAsync(importContext);

        // #2 Content items
        const contentItems = await this.importContentItemsAsync(importContext);

        // #3 Language variants
        await this.importLanguageVariantsAsync(importContext, contentItems);

        this.config.logger.log({
            type: 'info',
            message: `Finished import`
        });
    }

    private async importAssetsAsync(importContext: ImportContext): Promise<void> {
        if (!importContext.assets.length) {
            this.config.logger.log({
                type: 'info',
                message: `There are no assets to import`
            });
            return;
        }

        await assetsImporter({
            client: this.targetEnvironmentClient,
            importContext: importContext,
            logger: this.config.logger
        }).importAsync();
    }

    private async importContentItemsAsync(importContext: ImportContext): Promise<ContentItemModels.ContentItem[]> {
        if (!importContext.contentItems.length) {
            this.config.logger.log({
                type: 'info',
                message: `There are no content items to import`
            });
        }

        return await contentItemsImporter({
            client: this.targetEnvironmentClient,
            collections: await this.getCollectionsAsync(),
            importContext: importContext,
            logger: this.config.logger,
            skipFailedItems: this.config.skipFailedItems
        }).importAsync();
    }

    private async importLanguageVariantsAsync(
        importContext: ImportContext,
        contentItems: ContentItemModels.ContentItem[]
    ): Promise<void> {
        if (!importContext.contentItems.length) {
            this.config.logger.log({
                type: 'info',
                message: `There are no language variants to import`
            });
        }

        await languageVariantImporter({
            client: this.targetEnvironmentClient,
            importContext: importContext,
            logger: this.config.logger,
            preparedContentItems: contentItems,
            skipFailedItems: this.config.skipFailedItems,
            workflows: await this.getWorkflowsAsync()
        }).importAsync();
    }

    private async getWorkflowsAsync(): Promise<WorkflowModels.Workflow[]> {
        return await runMapiRequestAsync({
            logger: this.config.logger,
            func: async () => (await this.targetEnvironmentClient.listWorkflows().toPromise()).data,
            action: 'list',
            type: 'workflow'
        });
    }

    private async getCollectionsAsync(): Promise<CollectionModels.Collection[]> {
        return await runMapiRequestAsync({
            logger: this.config.logger,
            func: async () => (await this.targetEnvironmentClient.listCollections().toPromise()).data.collections,
            action: 'list',
            type: 'collection'
        });
    }
}
