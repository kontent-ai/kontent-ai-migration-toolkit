#!/usr/bin/env node
import { readFileSync } from 'fs';
import colors from 'colors';
import yargs from 'yargs';

import {
    ICliFileConfig,
    CliAction,
    getExtension,
    ExportAdapter,
    handleError,
    logErrorAndExit,
    confirmImportAsync,
    withDefaultLogAsync
} from '../../core/index.js';
import {
    ItemCsvProcessorService,
    ProcessingFormat,
    IItemFormatService,
    ItemJsonProcessorService,
    IAssetFormatService,
    AssetCsvProcessorService,
    AssetJsonProcessorService
} from '../../file-processor/index.js';
import { ExportToolkit, IImportToolkitConfig, ImportToolkit } from '../../toolkit/index.js';
import { IExportAdapter, KontentAiExportAdapter } from '../../export/index.js';
import { ImportSourceType } from '../../import/index.js';

type Args = { [key: string]: string | unknown };

const argv = yargs(process.argv.slice(2))
    .example(
        'kontent-ai-migration-toolkit --action=import --apiKey=xxx --environmentId=xxx --format=json --itemsFilename=items.zip --assetsFilename=assets.zip',
        'Imports data into target environment'
    )
    .example(
        'kontent-ai-migration-toolkit --action=export --adapter=kontentAi --environmentId=xxx --format=json --language=default --items=itemA,itemB',
        'Exports data from the environment'
    )
    .alias('a', 'action')
    .describe('a', 'Type of action to execute')
    .alias('ad', 'adapter')
    .describe('ad', 'Adapter used to export data')
    .alias('e', 'environmentId')
    .describe('e', 'environmentId')
    .alias('mapi', 'apiKey')
    .describe('mapi', 'Management API Key')
    .alias('a', 'action')
    .describe('a', 'Action to perform. One of: "export" | "import"')
    .alias('i', 'items')
    .describe('i', 'Comma separated item codenames to export')
    .alias('l', 'language')
    .describe('l', 'Language codename of items to export')
    .alias('if', 'itemsFilename')
    .describe('if', 'Name of items file to export / import')
    .alias('af', 'assetsFilename')
    .describe('af', 'Name of assets file to export / import')
    .alias('of', 'format')
    .describe('of', 'Format of the export. One of: "csv" | "json"')
    .alias('b', 'baseUrl')
    .describe('b', 'Custom base URL for Management API calls.')
    .alias('sfi', 'skipFailedItems')
    .describe('sfi', 'Indicates whether import should skip items that fail to import and cotinue with next item')
    .help('h')
    .alias('h', 'help').argv;

const exportAsync = async (config: ICliFileConfig) => {
    await withDefaultLogAsync(async (log) => {
        if (!config.adapter) {
            logErrorAndExit({
                message: `Missing 'adapter' config`
            });
        }

        let adapter: IExportAdapter | undefined;

        if (config.adapter === 'kontentAi') {
            if (!config.environmentId) {
                logErrorAndExit({
                    message: `Invalid 'environmentId' parameter`
                });
            }

            if (!config.managementApiKey) {
                logErrorAndExit({
                    message: `Invalid 'managementApiKey' parameter`
                });
            }

            const language = config.language;

            if (!language) {
                logErrorAndExit({
                    message: `Invalid 'language' parameter`
                });
            }

            if (!config.items) {
                logErrorAndExit({
                    message: `Invalid 'items' parameter`
                });
            }

            adapter = new KontentAiExportAdapter({
                log: log,
                environmentId: config.environmentId,
                managementApiKey: config.managementApiKey,
                baseUrl: config.baseUrl,
                exportItems: config.items.map((m) => {
                    return {
                        itemCodename: m,
                        languageCodename: language
                    };
                })
            });
        } else {
            logErrorAndExit({
                message: `Missing adapter '${colors.red(config.adapter)}'`
            });
        }

        const itemsFilename = config.itemsFilename ?? getDefaultExportFilename('items');
        const assetsFilename = config.assetsFilename ?? getDefaultExportFilename('assets');

        const exportToolkit = new ExportToolkit({
            log: log,
            adapter,
            items: {
                filename: itemsFilename,
                formatService: getItemFormatService(config.format)
            },
            assets: assetsFilename
                ? {
                      filename: assetsFilename,
                      formatService: getAssetFormatService(config.format)
                  }
                : undefined
        });

        await exportToolkit.exportAsync();

        log.console({ type: 'completed', message: `Export has been successful` });
    });
};

const importAsync = async (config: ICliFileConfig) => {
    const managementApiKey = config.managementApiKey;
    const environmentId = config.environmentId;

    if (!managementApiKey) {
        logErrorAndExit({
            message: `Missing 'managementApiKey' configuration option`
        });
    }
    if (!environmentId) {
        logErrorAndExit({
            message: `Missing 'environmentId' configuration option`
        });
    }

    await confirmImportAsync({
        force: config.force,
        apiKey: managementApiKey,
        environmentId: environmentId
    });

    await withDefaultLogAsync(async (log) => {
        const itemsFilename: string | undefined = config.itemsFilename;
        const assetsFilename: string | undefined = config.assetsFilename;

        const itemsFileExtension = getExtension(itemsFilename ?? '')?.toLowerCase();

        let sourceType: ImportSourceType;

        if (itemsFileExtension?.endsWith('zip'.toLowerCase())) {
            sourceType = 'zip';
        } else if (itemsFileExtension?.endsWith('csv'.toLowerCase())) {
            sourceType = 'file';
        } else if (itemsFileExtension?.endsWith('json'.toLowerCase())) {
            sourceType = 'file';
        } else {
            logErrorAndExit({
                message: `Unsupported file type '${colors.red(itemsFileExtension?.toString() ?? '')}'`
            });
        }

        const importToolkitConfig: IImportToolkitConfig = {
            log: log,
            sourceType: sourceType,
            skipFailedItems: config.skipFailedItems,
            baseUrl: config.baseUrl,
            environmentId: environmentId,
            managementApiKey: managementApiKey,
            canImport: {
                contentItem: (item) => {
                    return true;
                },
                asset: (asset) => {
                    return true;
                }
            }
        };

        const importToolkit = new ImportToolkit(importToolkitConfig);

        await importToolkit.importFromFilesAsync({
            items: itemsFilename
                ? {
                      filename: itemsFilename,
                      formatService: getItemFormatService(config.format)
                  }
                : undefined,
            assets: assetsFilename
                ? {
                      filename: assetsFilename,
                      formatService: getAssetFormatService(config.format)
                  }
                : undefined
        });

        log.console({ type: 'completed', message: `Import has been successful` });
    });
};

const run = async () => {
    const config = await getConfig();

    if (config.action === 'export') {
        await exportAsync(config);
    } else if (config.action === 'import') {
        await importAsync(config);
    } else {
        logErrorAndExit({
            message: `Invalid action '${colors.red(config.action)}'`
        });
    }
};

const getConfig = async () => {
    let resolvedArgs: Args = await argv;
    const configFilename: string | undefined = getOptionalArgumentValue(resolvedArgs, 'config');

    if (configFilename) {
        // get config from file
        const configFile = readFileSync(`./${configFilename}`);
        resolvedArgs = JSON.parse(configFile.toString());
    }

    const action: CliAction = getRequiredArgumentValue(resolvedArgs, 'action') as CliAction;
    const format: string | undefined = getOptionalArgumentValue(resolvedArgs, 'format');
    const adapter: string | undefined = getOptionalArgumentValue(resolvedArgs, 'adapter');

    let mappedFormat: ProcessingFormat = 'csv';
    let mappedAdapter: ExportAdapter = 'kontentAi';

    if (format?.toLowerCase() === <ProcessingFormat>'csv'.toLowerCase()) {
        mappedFormat = 'csv';
    } else if (format?.toLowerCase() === <ProcessingFormat>'json'.toLowerCase()) {
        mappedFormat = 'json';
    } else {
        if (action === 'export') {
            logErrorAndExit({
                message: `Unsupported export format '${colors.red(format ?? '')}'`
            });
        }
    }

    if (adapter?.toLowerCase() === <ExportAdapter>'kontentAi'.toLowerCase()) {
        mappedAdapter = 'kontentAi';
    } else {
        if (action === 'export') {
            logErrorAndExit({
                message: `Unsupported adapter '${adapter}'`
            });
        }
    }

    const config: ICliFileConfig = {
        action: action,
        managementApiKey: getOptionalArgumentValue(resolvedArgs, 'managementApiKey'),
        environmentId: getRequiredArgumentValue(resolvedArgs, 'environmentId'),
        itemsFilename: getOptionalArgumentValue(resolvedArgs, 'itemsFilename'),
        assetsFilename: getOptionalArgumentValue(resolvedArgs, 'assetsFilename'),
        baseUrl: getOptionalArgumentValue(resolvedArgs, 'baseUrl'),
        items:
            getOptionalArgumentValue(resolvedArgs, 'items')
                ?.split(',')
                .map((m) => m.trim()) ?? [],
        skipFailedItems: getBooleanArgumentvalue(resolvedArgs, 'skipFailedItems', false),
        force: getBooleanArgumentvalue(resolvedArgs, 'force', false),
        adapter: mappedAdapter,
        format: mappedFormat,
        language: getOptionalArgumentValue(resolvedArgs, 'language')
    };

    return config;
};

const getDefaultExportFilename = (type: 'items' | 'assets') => {
    return `${type}-export.zip`;
};

function getAssetFormatService(format: ProcessingFormat | undefined): IAssetFormatService {
    if (format === 'csv') {
        return new AssetCsvProcessorService();
    }

    if (format === 'json') {
        return new AssetJsonProcessorService();
    }

    logErrorAndExit({
        message: `Unsupported format '${colors.red(format ?? '')}' for assets export`
    });
}

function getItemFormatService(format: ProcessingFormat | undefined): IItemFormatService {
    if (format === 'csv') {
        return new ItemCsvProcessorService();
    }

    if (format === 'json') {
        return new ItemJsonProcessorService();
    }

    logErrorAndExit({
        message: `Unsupported format '${colors.red(format ?? '')}' for items export`
    });
}

function getOptionalArgumentValue(args: Args, argName: string): string | undefined {
    return args[argName]?.toString();
}

function getRequiredArgumentValue(args: Args, argName: string): string {
    const value = getOptionalArgumentValue(args, argName);

    if (!value) {
        logErrorAndExit({
            message: `Missing '${colors.red(argName)}' argument value`
        });
    }

    return value;
}

function getBooleanArgumentvalue(args: Args, argName: string, defaultValue: boolean): boolean {
    const value = getOptionalArgumentValue(args, argName);

    if (!value) {
        return defaultValue;
    }

    return value.toLowerCase() === 'true'.toLowerCase();
}

run().catch((err) => {
    handleError(err);
});
