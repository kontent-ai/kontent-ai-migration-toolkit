#!/usr/bin/env node
import { readFileSync } from 'fs';
import yargs from 'yargs';

import { ICliFileConfig, CliAction, getExtension, extractErrorMessage } from '../../core/index.js';
import { ExportService } from '../../export/index.js';
import { ImportService } from '../../import/index.js';
import {
    ItemCsvProcessorService,
    ProcessingFormat,
    FileProcessorService,
    IItemFormatService,
    ItemJsonProcessorService,
    ItemJsonJoinedProcessorService,
    IAssetFormatService,
    AssetCsvProcessorService,
    AssetJsonProcessorService
} from '../../file-processor/index.js';
import { FileService } from '../file/file.service.js';
import { logDebug } from '../../core/log-helper.js';

type Args = { [key: string]: string | unknown };

const argv = yargs(process.argv.slice(2))
    .example(
        'csvm --action=export --format=csv|json --apiKey=xxx --environmentId=xxx',
        'Creates zip export of Kontent.ai content data'
    )
    .example(
        'csvm --action=restore --apiKey=xxx --environmentId=xxx --filename=exportFile',
        'Read given zip file and recreates data in Kontent.ai environment'
    )
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
    .alias('ia', 'importAssets')
    .describe('ia', 'Disables / enables asset import')
    .alias('is', 'isSecure')
    .describe('is', 'Disables / enables use of Secure API for export')
    .alias('a', 'action')
    .describe('a', 'Action to perform. One of: "export" | "restore"')
    .alias('if', 'itemsFilename')
    .describe('if', 'Name of items file to export / restore')
    .alias('af', 'assetsFilename')
    .describe('af', 'Name of assets file to export / restore')
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
    const exportService = new ExportService({
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

    const fileService = new FileService();
    const fileProcessorService = new FileProcessorService();

    const response = await exportService.exportAllAsync();

    const itemsZipFileData = await fileProcessorService.createItemsZipAsync(response, {
        itemFormatService: getItemFormatService(config.format),
        transformConfig: {
            richTextConfig: {
                replaceInvalidLinks: config.replaceInvalidLinks
            }
        }
    });

    const itemsFilename = config.itemsFilename ?? getDefaultExportFilename('items');
    await fileService.writeFileAsync(getZipFilename(itemsFilename), itemsZipFileData);

    if (config.assetsFilename && config.exportAssets) {
        const assetsZipFileData = await fileProcessorService.createAssetsZipAsync(response, {
            assetFormatService: getAssetFormatService(config.format)
        });
        await fileService.writeFileAsync(getZipFilename(config.assetsFilename), assetsZipFileData);
    }

    logDebug({ type: 'info', message: `Completed` });
};

const restoreAsync = async (config: ICliFileConfig) => {
    const fileProcessorService = new FileProcessorService();

    if (!config.managementApiKey) {
        throw Error(`Missing 'managementApiKey' configuration option`);
    }

    const fileService = new FileService();
    const importService = new ImportService({
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
        }
    });

    const itemsFilename = config.itemsFilename ?? getDefaultExportFilename('items');

    const contentTypes = await importService.getImportContentTypesAsync();
    const itemsFile = await fileService.loadFileAsync(itemsFilename);
    const itemsFileExtension = getExtension(itemsFilename);

    let assetsFile: Buffer | undefined = undefined;
    if (config.importAssets) {
        const assetsFilename = config.assetsFilename ?? getDefaultExportFilename('assets');

        logDebug({
            type: 'info',
            message: `Importing assets from file`,
            partA: assetsFilename
        });

        assetsFile = await fileService.loadFileAsync(assetsFilename);
        const assetsFileExtension = getExtension(assetsFilename);

        if (!assetsFileExtension?.endsWith('zip')) {
            throw Error(`Assets required zip folder. Received '${config.assetsFilename}'`);
        }
    } else {
        logDebug({
            type: 'info',
            message: `Skipping assets import`
        });
    }

    if (itemsFileExtension?.endsWith('zip')) {
        const data = await fileProcessorService.extractZipAsync(itemsFile, assetsFile, contentTypes, {
            assetFormatService: getAssetFormatService(config.format),
            itemFormatService: getItemFormatService(config.format)
        });
        await importService.importFromSourceAsync(data);
    } else if (itemsFileExtension?.endsWith('csv')) {
        const data = await fileProcessorService.extractCsvFileAsync(itemsFile, contentTypes);
        await importService.importFromSourceAsync(data);
    } else if (itemsFileExtension?.endsWith('json')) {
        const data = await fileProcessorService.extractJsonFileAsync(itemsFile, contentTypes);
        await importService.importFromSourceAsync(data);
    } else {
        throw Error(`Unsupported file type '${itemsFileExtension}'`);
    }

    logDebug({ type: 'info', message: `Completed` });
};

const run = async () => {
    const config = await getConfig();

    if (config.action === 'export') {
        await exportAsync(config);
    } else if (config.action === 'restore') {
        await restoreAsync(config);
    } else {
        throw Error(`Invalid action`);
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

    let mappedFormat: ProcessingFormat = 'csv';

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
        importAssets: getBooleanArgumentvalue(resolvedArgs, 'importAssets', false),
        replaceInvalidLinks: getBooleanArgumentvalue(resolvedArgs, 'replaceInvalidLinks', false),
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

function getZipFilename(filename: string): string {
    if (filename.toLowerCase()?.endsWith('.zip')) {
        return filename;
    }
    return `${filename}.zip`;
}
