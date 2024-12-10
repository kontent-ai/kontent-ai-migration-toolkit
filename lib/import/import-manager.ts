import { ManagementClient } from '@kontent-ai/management-sdk';
import chalk from 'chalk';
import { defaultExternalIdGenerator, extractErrorData, getDefaultLogger, getMigrationManagementClient, Logger } from '../core/index.js';
import { importContextFetcherAsync } from './context/import-context-fetcher.js';
import {
    EditedAsset,
    ImportConfig,
    ImportContext,
    ImportedAsset,
    ImportedItem,
    ImportedLanguageVariant,
    ImportResult
} from './import.models.js';
import { assetsImporter } from './importers/assets-importer.js';
import { contentItemsImporter } from './importers/content-items-importer.js';
import { languageVariantImporter } from './importers/language-variant-importer.js';

export function importManager(config: ImportConfig) {
    const logger: Logger = config.logger ?? getDefaultLogger();
    const targetEnvironmentClient: Readonly<ManagementClient> = getMigrationManagementClient(config);

    const importAssetsAsync = async (importContext: ImportContext): Promise<Pick<ImportResult, 'editedAssets' | 'uploadedAssets'>> => {
        if (!importContext.categorizedImportData.assets.length) {
            logger.log({
                type: 'info',
                message: `There are no assets to import`
            });
            return {
                editedAssets: [],
                uploadedAssets: []
            };
        }

        return await assetsImporter({
            client: targetEnvironmentClient,
            importContext: importContext,
            logger: logger
        }).importAsync();
    };

    const importContentItemsAsync = async (importContext: ImportContext): Promise<readonly ImportedItem[]> => {
        if (!importContext.categorizedImportData.contentItems.length) {
            logger.log({
                type: 'info',
                message: `There are no content items to import`
            });
        }

        return await contentItemsImporter({
            client: targetEnvironmentClient,
            importContext: importContext,
            logger: logger
        }).importAsync();
    };

    const importLanguageVariantsAsync = async (
        importContext: ImportContext,
        contentItems: readonly ImportedItem[]
    ): Promise<readonly ImportedLanguageVariant[]> => {
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
            preparedContentItems: contentItems
        }).importAsync();
    };

    const getImportErrors = (
        contentItems: readonly ImportedItem[],
        languageVariants: readonly ImportedLanguageVariant[],
        importedAssets: readonly ImportedAsset[],
        editedAssets: readonly EditedAsset[]
    ): readonly string[] => {
        return [
            ...editedAssets
                .filter((m) => m.error)
                .map(
                    (m) =>
                        `Failed to edit asset '${chalk.yellow(m.inputItem.migrationAsset.codename)}': ${extractErrorData(m.error).message}`
                ),
            ...importedAssets
                .filter((m) => m.error)
                .map((m) => `Failed to upload asset '${chalk.yellow(m.inputItem.codename)}': ${extractErrorData(m.error).message}`),
            ...contentItems
                .filter((m) => m.error)
                .map(
                    (m) =>
                        `Failed to import content item '${chalk.yellow(m.inputItem.system.codename)}': ${extractErrorData(m.error).message}`
                ),
            ...languageVariants
                .filter((m) => m.error)
                .map(
                    (m) =>
                        `Failed to import language variant '${chalk.yellow(m.inputItem.system.codename)}' in language '${chalk.yellow(
                            m.inputItem.system.language.codename
                        )}': ${extractErrorData(m.error).message}`
                )
        ];
    };

    return {
        async importAsync(): Promise<ImportResult> {
            const importContext = await (
                await importContextFetcherAsync({
                    migrationData: config.data,
                    externalIdGenerator: config.externalIdGenerator ?? defaultExternalIdGenerator,
                    logger: logger,
                    managementClient: targetEnvironmentClient
                })
            ).getImportContextAsync();

            // #1 Assets
            const { editedAssets, uploadedAssets } = await importAssetsAsync(importContext);

            // #2 Content items
            const contentItems = await importContentItemsAsync(importContext);

            // #3 Language variants
            const languageVariants = await importLanguageVariantsAsync(importContext, contentItems);

            const importErrors = getImportErrors(contentItems, languageVariants, uploadedAssets, editedAssets);

            if (importErrors.length) {
                importErrors.forEach((error, index) => logger.log({ type: chalk.red(`#${index + 1}`), message: error }));
                logger.log({
                    type: 'completed',
                    message: `Finished import with '${chalk.red(importErrors.length)}' errors`
                });
            } else {
                logger.log({
                    type: 'completed',
                    message: `Finished import`
                });
            }

            return {
                editedAssets,
                uploadedAssets,
                contentItems,
                languageVariants
            };
        }
    };
}
