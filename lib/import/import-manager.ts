import {
    CollectionModels,
    ContentItemModels,
    LanguageVariantModels,
    ManagementClient,
    WorkflowModels
} from '@kontent-ai/management-sdk';

import {
    runMapiRequestAsync,
    defaultExternalIdGenerator,
    Logger,
    getDefaultLogger,
    getMigrationManagementClient
} from '../core/index.js';
import { ImportConfig, ImportContext, ImportResult } from './import.models.js';
import { assetsImporter } from './importers/assets-importer.js';
import { contentItemsImporter } from './importers/content-items-importer.js';
import { languageVariantImporter } from './importers/language-variant-importer.js';
import { importContextFetcher } from './context/import-context-fetcher.js';

export function importManager(config: ImportConfig) {
    const logger: Logger = config.logger ?? getDefaultLogger();
    const targetEnvironmentClient: ManagementClient = getMigrationManagementClient({
        environmentId: config.environmentId,
        retryStrategy: config.retryStrategy,
        apiKey: config.apiKey
    });

    const importAssetsAsync = async (importContext: ImportContext): Promise<void> => {
        if (!importContext.categorizedImportData.assets.length) {
            logger.log({
                type: 'info',
                message: `There are no assets to import`
            });
            return;
        }

        await assetsImporter({
            client: targetEnvironmentClient,
            importContext: importContext,
            logger: logger
        }).importAsync();
    };
    const importContentItemsAsync = async (
        importContext: ImportContext
    ): Promise<readonly ContentItemModels.ContentItem[]> => {
        if (!importContext.categorizedImportData.contentItems.length) {
            logger.log({
                type: 'info',
                message: `There are no content items to import`
            });
        }

        return await contentItemsImporter({
            client: targetEnvironmentClient,
            collections: await getCollectionsAsync(),
            importContext: importContext,
            logger: logger,
            skipFailedItems: config.skipFailedItems ?? false
        }).importAsync();
    };

    const importLanguageVariantsAsync = async (
        importContext: ImportContext,
        contentItems: readonly ContentItemModels.ContentItem[]
    ): Promise<readonly LanguageVariantModels.ContentItemLanguageVariant[]> => {
        if (!importContext.categorizedImportData.contentItems.length) {
            logger.log({
                type: 'info',
                message: `There are no language variants to import`
            });
        }

        return await languageVariantImporter({
            client: targetEnvironmentClient,
            importContext: importContext,
            logger: logger,
            preparedContentItems: contentItems,
            skipFailedItems: config.skipFailedItems ?? false,
            workflows: await getWorkflowsAsync()
        }).importAsync();
    };

    const getWorkflowsAsync = async (): Promise<readonly WorkflowModels.Workflow[]> => {
        return await runMapiRequestAsync({
            logger: logger,
            func: async () => (await targetEnvironmentClient.listWorkflows().toPromise()).data,
            action: 'list',
            type: 'workflow'
        });
    };

    const getCollectionsAsync = async (): Promise<readonly CollectionModels.Collection[]> => {
        return await runMapiRequestAsync({
            logger: logger,
            func: async () => (await targetEnvironmentClient.listCollections().toPromise()).data.collections,
            action: 'list',
            type: 'collection'
        });
    };

    return {
        async importAsync(): Promise<ImportResult> {
            const importContext = await importContextFetcher({
                migrationData: config.data,
                externalIdGenerator: config.externalIdGenerator ?? defaultExternalIdGenerator,
                logger: logger,
                managementClient: targetEnvironmentClient
            }).getImportContextAsync();

            // Import order matters
            // #1 Assets
            await importAssetsAsync(importContext);

            // #2 Content items
            const contentItems = await importContentItemsAsync(importContext);

            // #3 Language variants
            const languageVariants = await importLanguageVariantsAsync(importContext, contentItems);

            logger.log({
                type: 'completed',
                message: `Finished import`
            });

            return {
                contentItems,
                languageVariants
            };
        }
    };
}
