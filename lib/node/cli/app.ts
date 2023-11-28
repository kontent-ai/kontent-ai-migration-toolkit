#!/usr/bin/env node
import { readFileSync } from 'fs';
import * as yargs from 'yargs';

import { ICliFileConfig, CliAction, getExtension, extractErrorMessage } from '../../core';
import { ExportService } from '../../export';
import { ImportService } from '../../import';
import {
    ItemCsvProcessorService,
    ProcessingFormat,
    FileProcessorService,
    IItemFormatService,
    ItemJsonProcessorService,
    ItemJsonSingleProcessorService,
    IAssetFormatService,
    AssetCsvProcessorService,
    AssetJsonProcessorService
} from '../../file-processor';
import { FileService } from '../file/file.service';
import { logDebug } from '../../core/log-helper';

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
    .alias('is', 'isSecure')
    .describe('is', 'Disables / enables use of Secure API for export')
    .alias('a', 'action')
    .describe('a', 'Action to perform. One of: "export" | "restore"')
    .alias('if', 'itemsFilename')
    .describe('if', 'Name of items file to export / restore')
    .alias('af', 'assetsFilename')
    .describe('af', 'Name of assets file to export / restore')
    .alias('of', 'format')
    .describe('of', 'Format of the export. One of: "csv" | "json" | "jsonSingle"')
    .alias('b', 'baseUrl')
    .describe('b', 'Custom base URL for Management API calls.')
    .alias('sfi', 'skipFailedItems')
    .describe('sfi', 'Indicates whether import should skip items that fail to import and cotinue with next item')
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
        itemFormatService: getItemFormatService(config.format)
    });

    await fileService.writeFileAsync(getZipFilename(config.itemsFilename), itemsZipFileData);

    if (config.assetsFilename) {
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

    const contentTypes = await importService.getImportContentTypesAsync();
    const itemsFile = await fileService.loadFileAsync(config.itemsFilename);
    const itemsFileExtension = getExtension(config.itemsFilename);

    let assetsFile: Buffer | undefined = undefined;
    if (config.assetsFilename) {
        assetsFile = await fileService.loadFileAsync(config.assetsFilename);
        const assetsFileExtension = getExtension(config.assetsFilename);

        if (!assetsFileExtension?.endsWith('zip')) {
            throw Error(`Assets required zip folder. Received '${config.assetsFilename}'`);
        }
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

    if (format?.toLowerCase() === 'csv') {
        mappedFormat = 'csv';
    } else if (format?.toLowerCase() === 'json') {
        mappedFormat = 'json';
    } else {
        if (action === 'export') {
            throw Error(`Unsupported export format '${format}'`);
        }
    }

    const config: ICliFileConfig = {
        action: action,
        managementApiKey: getOptionalArgumentValue(resolvedArgs, 'managementApiKey'),
        environmentId: getRequiredArgumentValue(resolvedArgs, 'environmentId'),
        itemsFilename: getOptionalArgumentValue(resolvedArgs, 'itemsFilename') ?? getDefaultExportFilename('items'),
        assetsFilename: getOptionalArgumentValue(resolvedArgs, 'assetsFilename') ?? getDefaultExportFilename('assets'),
        baseUrl: getOptionalArgumentValue(resolvedArgs, 'baseUrl'),
        exportTypes:
            getOptionalArgumentValue(resolvedArgs, 'exportTypes')
                ?.split(',')
                .map((m) => m.trim()) ?? [],
        skipFailedItems: getBooleanArgumentvalue(resolvedArgs, 'skipFailedItems'),
        secureApiKey: getOptionalArgumentValue(resolvedArgs, 'secureApiKey'),
        previewApiKey: getOptionalArgumentValue(resolvedArgs, 'previewApiKey'),
        exportAssets: getBooleanArgumentvalue(resolvedArgs, 'exportAssets'),
        isPreview: getBooleanArgumentvalue(resolvedArgs, 'isPreview'),
        isSecure: getBooleanArgumentvalue(resolvedArgs, 'isSecure'),
        format: mappedFormat
    };

    return config;
};

const getDefaultExportFilename = (type: 'items' | 'assets') => {
    const date = new Date();
    return `${type}-export-${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}.zip`;
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

    if (format === 'json' || format === 'jsonSingle') {
        return new AssetJsonProcessorService();
    }

    throw Error(`Unsupported format '${format}' for exporting assets`);
}

function getItemFormatService(format: ProcessingFormat | undefined): IItemFormatService {
    if (format === 'csv') {
        return new ItemCsvProcessorService();
    }

    if (format === 'json') {
        return new ItemJsonProcessorService();
    }

    if (format === 'jsonSingle') {
        return new ItemJsonSingleProcessorService();
    }

    throw Error(`Unsupported format '${format}' for exporting assets`);
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

function getBooleanArgumentvalue(args: Args, argName: string): boolean {
    return getOptionalArgumentValue(args, argName)?.toLowerCase() === 'true'.toLowerCase();
}

function getZipFilename(filename: string): string {
    if (filename.toLowerCase()?.endsWith('.zip')) {
        return filename;
    }
    return `${filename}.zip`;
}
