#!/usr/bin/env node
import { readFileSync } from 'fs';
import yargs from 'yargs';

import { ICliFileConfig, CliAction, getExtension, extractErrorMessage, ExportAdapter } from '../../core/index.js';
import {
    ItemCsvProcessorService,
    ProcessingFormat,
    IItemFormatService,
    ItemJsonProcessorService,
    ItemJsonJoinedProcessorService,
    IAssetFormatService,
    AssetCsvProcessorService,
    AssetJsonProcessorService
} from '../../file-processor/index.js';
import { logDebug } from '../../core/log-helper.js';
import { ExportToolkit, ImportToolkit } from '../../toolkit/index.js';
import { IExportAdapter, KontentAiExportAdapter } from '../../export/index.js';

type Args = { [key: string]: string | unknown };

const argv = yargs(process.argv.slice(2))
    .example(
        'csvm --action=export --format=csv|json --apiKey=xxx --environmentId=xxx',
        'Creates zip export of Kontent.ai content data'
    )
    .example(
        'csvm --action=import --apiKey=xxx --environmentId=xxx --filename=exportFile',
        'Read given zip file and recreates data in Kontent.ai environment'
    )
    .alias('a', 'action')
    .describe('a', 'Type of action to execute')
    .alias('ad', 'adapter')
    .describe('ad', 'Adapter used to export data')
    .alias('e', 'environmentId')
    .describe('e', 'environmentId')
    .alias('mapi', 'apiKey')
    .describe('mapi', 'Management API Key')
    .alias('sapi', 'secureApiKey')
    .describe('sapi', 'API Key required when Delivery API has secure access enabled')
    .alias('papi', 'previewApiKey')
    .describe('papi', 'Use if you want to export data using Preview API')
    .alias('ip', 'isPreview')
    .describe('ip', 'Disables / enables use of preview API for export')
    .alias('ea', 'exportAssets')
    .describe('ea', 'Disables / enables asset export')
    .alias('is', 'isSecure')
    .describe('is', 'Disables / enables use of Secure API for export')
    .alias('a', 'action')
    .describe('a', 'Action to perform. One of: "export" | "import"')
    .alias('if', 'itemsFilename')
    .describe('if', 'Name of items file to export / import')
    .alias('af', 'assetsFilename')
    .describe('af', 'Name of assets file to export / import')
    .alias('of', 'format')
    .describe('of', 'Format of the export. One of: "csv" | "json" | "jsonJoined"')
    .alias('b', 'baseUrl')
    .describe('b', 'Custom base URL for Management API calls.')
    .alias('sfi', 'skipFailedItems')
    .describe('sfi', 'Indicates whether import should skip items that fail to import and cotinue with next item')
    .alias('ril', 'replaceInvalidLinks')
    .describe('ril', 'Instructs import to replace invalid links')
    .alias('et', 'exportTypes')
    .describe(
        'et',
        'Can be used to export only selected content types. Expects CSV of type codenames. If not provided, all content items of all types are exported'
    )
    .help('h')
    .alias('h', 'help').argv;

const exportAsync = async (config: ICliFileConfig) => {
    if (!config.adapter) {
        throw Error(`Missing 'adapter' config`);
    }

    let adapter: IExportAdapter | undefined;

    if (config.adapter === 'kontentAi') {
        if (!config.environmentId) {
            throw Error(`Invalid environment id`);
        }

        adapter = new KontentAiExportAdapter({
            environmentId: config.environmentId,
            managementApiKey: config.managementApiKey,
            previewApiKey: config.previewApiKey,
            secureApiKey: config.secureApiKey,
            isPreview: config.isPreview,
            isSecure: config.isSecure,
            baseUrl: config.baseUrl,
            exportTypes: config.exportTypes,
            exportAssets: config.exportAssets
        });
    } else {
        throw Error(`Missing adapter '${config.adapter}'`);
    }

    const exportToolkit = new ExportToolkit({ adapter });

    const itemsFilename = config.itemsFilename ?? getDefaultExportFilename('items');
    const assetsFilename = config.assetsFilename ?? getDefaultExportFilename('assets');

    await exportToolkit.exportAsync({
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

    logDebug({ type: 'info', message: `Completed` });
};

const importAsync = async (config: ICliFileConfig) => {
    if (!config.managementApiKey) {
        throw Error(`Missing 'managementApiKey' configuration option`);
    }
    if (!config.environmentId) {
        throw Error(`Missing 'environmentId' configuration option`);
    }

    const itemsFilename: string | undefined = config.itemsFilename;
    const assetsFilename: string | undefined = config.assetsFilename;

    const importToolkit = new ImportToolkit({
        skipFailedItems: config.skipFailedItems,
        baseUrl: config.baseUrl,
        environmentId: config.environmentId,
        managementApiKey: config.managementApiKey,
        canImport: {
            contentItem: (item) => {
                return true;
            },
            asset: (asset) => {
                return true;
            }
        },
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

    const itemsFileExtension = getExtension(itemsFilename ?? '')?.toLowerCase();

    if (itemsFileExtension?.endsWith('zip'.toLowerCase())) {
        await importToolkit.importFromZipAsync();
    } else if (itemsFileExtension?.endsWith('csv'.toLowerCase())) {
        await importToolkit.importFromFileAsync();
    } else if (itemsFileExtension?.endsWith('json'.toLowerCase())) {
        await importToolkit.importFromFileAsync();
    } else {
        throw Error(`Unsupported file type '${itemsFileExtension}'`);
    }

    logDebug({ type: 'info', message: `Completed` });
};

const run = async () => {
    const config = await getConfig();

    if (config.action === 'export') {
        await exportAsync(config);
    } else if (config.action === 'import') {
        await importAsync(config);
    } else {
        throw Error(`Invalid action '${config.action}'`);
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

    if (format?.toLowerCase() === 'csv'.toLowerCase()) {
        mappedFormat = 'csv';
    } else if (format?.toLowerCase() === 'json'.toLowerCase()) {
        mappedFormat = 'json';
    } else if (format?.toLowerCase() === 'jsonJoined'.toLowerCase()) {
        mappedFormat = 'jsonJoined';
    } else {
        if (action === 'export') {
            throw Error(`Unsupported export format '${format}'`);
        }
    }

    if (adapter?.toLowerCase() === 'kontentAi'.toLowerCase()) {
        mappedAdapter = 'kontentAi';
    } else {
        if (action === 'export') {
            throw Error(`Unsupported adapter '${adapter}'`);
        }
    }

    const config: ICliFileConfig = {
        action: action,
        managementApiKey: getOptionalArgumentValue(resolvedArgs, 'managementApiKey'),
        environmentId: getRequiredArgumentValue(resolvedArgs, 'environmentId'),
        itemsFilename: getOptionalArgumentValue(resolvedArgs, 'itemsFilename'),
        assetsFilename: getOptionalArgumentValue(resolvedArgs, 'assetsFilename'),
        baseUrl: getOptionalArgumentValue(resolvedArgs, 'baseUrl'),
        exportTypes:
            getOptionalArgumentValue(resolvedArgs, 'exportTypes')
                ?.split(',')
                .map((m) => m.trim()) ?? [],
        skipFailedItems: getBooleanArgumentvalue(resolvedArgs, 'skipFailedItems', false),
        secureApiKey: getOptionalArgumentValue(resolvedArgs, 'secureApiKey'),
        previewApiKey: getOptionalArgumentValue(resolvedArgs, 'previewApiKey'),
        exportAssets: getBooleanArgumentvalue(resolvedArgs, 'exportAssets', false),
        isPreview: getBooleanArgumentvalue(resolvedArgs, 'isPreview', false),
        isSecure: getBooleanArgumentvalue(resolvedArgs, 'isSecure', false),
        replaceInvalidLinks: getBooleanArgumentvalue(resolvedArgs, 'replaceInvalidLinks', false),
        adapter: mappedAdapter,
        format: mappedFormat
    };

    return config;
};

const getDefaultExportFilename = (type: 'items' | 'assets') => {
    return `${type}-export.zip`;
};

run()
    .then((m) => {})
    .catch((err) => {
        console.error(err);
        logDebug({ type: 'error', message: extractErrorMessage(err) });
    });

function getAssetFormatService(format: ProcessingFormat | undefined): IAssetFormatService {
    if (format === 'csv') {
        return new AssetCsvProcessorService();
    }

    if (format === 'json' || format === 'jsonJoined') {
        return new AssetJsonProcessorService();
    }

    throw Error(`Unsupported format '${format}' for assets export`);
}

function getItemFormatService(format: ProcessingFormat | undefined): IItemFormatService {
    if (format === 'csv') {
        return new ItemCsvProcessorService();
    }

    if (format === 'json') {
        return new ItemJsonProcessorService();
    }

    if (format === 'jsonJoined') {
        return new ItemJsonJoinedProcessorService();
    }

    throw Error(`Unsupported format '${format}' for items export`);
}

function getOptionalArgumentValue(args: Args, argName: string): string | undefined {
    return args[argName]?.toString();
}

function getRequiredArgumentValue(args: Args, argName: string): string {
    const value = getOptionalArgumentValue(args, argName);

    if (!value) {
        throw Error(`Missing '${argName}' argument value`);
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
