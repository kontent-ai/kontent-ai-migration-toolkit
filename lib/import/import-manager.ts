import { ManagementClient } from '@kontent-ai/management-sdk';
import chalk from 'chalk';
import { defaultExternalIdGenerator, extractErrorData, getDefaultLogger, getMigrationManagementClient, Logger } from '../core/index.js';
import { importContextFetcherAsync } from './context/import-context-fetcher.js';
import { ImportConfig, ImportContext, ImportedItem, ImportedLanguageVariant, ImportResult } from './import.models.js';
import { assetsImporter } from './importers/assets-importer.js';
import { contentItemsImporter } from './importers/content-items-importer.js';
import { languageVariantImporter } from './importers/language-variant-importer.js';

const reportFilename: string = `import-report.json`;

type ReportResult = {
    readonly errorsCount: number;
    readonly assets: {
        readonly count: number;
        readonly successful: Array<{ readonly codename: string }>;
        readonly failed: Array<{ readonly codename: string; readonly error: string }>;
    };
    readonly languageVariants: {
        readonly count: number;
        readonly successful: Array<{
            readonly codename: string;
            readonly language: { readonly codename: string };
            readonly type: { readonly codename: string };
        }>;
        readonly failed: Array<{
            readonly codename: string;
            readonly language: { readonly codename: string };
            readonly type: { readonly codename: string };
            readonly error: string;
        }>;
    };
    readonly contentItems: {
        readonly count: number;
        readonly successful: Array<{ readonly codename: string }>;
        readonly failed: Array<{ readonly codename: string; readonly type: { readonly codename: string }; readonly error: string }>;
    };
};

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

    const getReportResult = (importResult: ImportResult): ReportResult => {
        return {
            errorsCount:
                importResult.editedAssets.filter((m) => m.state === 'error').length +
                importResult.uploadedAssets.filter((m) => m.state === 'error').length +
                importResult.contentItems.filter((m) => m.state === 'error').length +
                importResult.languageVariants.filter((m) => m.state === 'error').length,
            assets: {
                count: importResult.uploadedAssets.length + importResult.editedAssets.length,
                successful: [
                    ...importResult.uploadedAssets.filter((m) => m.state === 'valid').map((m) => m.inputItem.codename),
                    ...importResult.editedAssets.filter((m) => m.state === 'valid').map((m) => m.inputItem.migrationAsset.codename)
                ].map((m) => {
                    return {
                        codename: m
                    };
                }),
                failed: [
                    ...importResult.uploadedAssets
                        .filter((m) => m.state === 'error')
                        .map((m) => {
                            return {
                                codename: m.inputItem.codename,
                                error: extractErrorData(m.error).message
                            };
                        }),
                    ...importResult.editedAssets
                        .filter((m) => m.state === 'error')
                        .map((m) => {
                            return {
                                codename: m.inputItem.migrationAsset.codename,
                                error: extractErrorData(m.error).message
                            };
                        })
                ]
            },
            contentItems: {
                count: importResult.contentItems.length,
                successful: importResult.contentItems
                    .filter((m) => m.state === 'valid')
                    .map((m) => {
                        return {
                            codename: m.inputItem.system.codename
                        };
                    }),
                failed: importResult.contentItems
                    .filter((m) => m.state === 'error')
                    .map((m) => {
                        return {
                            codename: m.inputItem.system.codename,
                            type: m.inputItem.system.type,
                            error: extractErrorData(m.error).message
                        };
                    })
            },
            languageVariants: {
                count: importResult.languageVariants.length,
                successful: importResult.languageVariants
                    .filter((m) => m.state === 'valid')
                    .map((m) => {
                        return {
                            codename: m.inputItem.system.codename,
                            language: m.inputItem.system.language,
                            type: m.inputItem.system.type
                        };
                    }),
                failed: importResult.languageVariants
                    .filter((m) => m.state === 'error')
                    .map((m) => {
                        return {
                            codename: m.inputItem.system.codename,
                            language: m.inputItem.system.language,
                            type: m.inputItem.system.type,
                            error: extractErrorData(m.error).message
                        };
                    })
            }
        };
    };

    const printReportToConsole = (reportResult: ReportResult, logger: Logger): void => {
        const errors = [
            ...reportResult.assets.failed.map((m) => [
                `Object type: ${chalk.yellow('Asset')}`,
                `Codename: ${chalk.yellow(m.codename)}`,
                `${chalk.red(m.error)}`
            ]),
            ...reportResult.contentItems.failed.map((m) => [
                `Object type: ${chalk.yellow('Content item')}`,
                `Codename:${chalk.yellow(m.codename)}`,
                `Content Type: ${chalk.yellow(m.type.codename)}`,
                `${chalk.red(m.error)}`
            ]),
            ...reportResult.languageVariants.failed.map((m) => [
                `Object type: ${chalk.yellow('Language variant')}`,
                `Codename: ${chalk.yellow(m.codename)}`,
                `Language: ${chalk.yellow(m.language.codename)}`,
                `Content Type: ${chalk.yellow(m.type.codename)}`,
                `${chalk.red(m.error)}`
            ])
        ];

        errors.forEach((error, index) => {
            logger.log({ message: `${chalk.red(`\nError #${index + 1}`)}` });
            error.forEach((m) => {
                logger.log({ message: m });
            });
        });
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

            const reportResult = getReportResult({
                contentItems,
                editedAssets,
                languageVariants,
                uploadedAssets
            });

            if (reportResult.errorsCount) {
                printReportToConsole(reportResult, logger);
                logger.log({
                    type: 'completed',
                    message: `Finished import with '${chalk.red(reportResult.errorsCount)}' ${
                        reportResult.errorsCount === 1 ? 'error' : 'errors'
                    }`
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
        },
        getReportFile(importResult: ImportResult): { readonly filename: string; readonly content: string } {
            return {
                filename: reportFilename,
                content: JSON.stringify(getReportResult(importResult))
            };
        }
    };
}
