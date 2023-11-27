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

const argv = yargs(process.argv.slice(2))
    .example(
        'csvm --action=export --format=csv|json --apiKey=xxx --environmentId=xxx',
        'Creates zip export of Kontent.ai content data'
    )
    .example(
        'csvm --action=restore --apiKey=xxx --environmentId=xxx --filename=exportFile',
        'Read given zip file and recreates data in Kontent.ai environment'
    )
    .alias('p', 'environmentId')
    .describe('p', 'environmentId')
    .alias('ak', 'apiKey')
    .describe('ak', 'Management API Key')
    .alias('sk', 'secureApiKey')
    .describe('sk', 'API Key required when Delivery API has secure access enabled')
    .alias('pk', 'previewApiKey')
    .describe('pk', 'Use if you want to export data using Preview API')
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
    const fetchAssetDetails: boolean = config.assetsFilename && config.fetchAssetDetails ? true : false;

    const exportService = new ExportService({
        environmentId: config.environmentId,
        apiKey: config.apiKey,
        isPreview: config.isPreview,
        isSecure: config.isSecure,
        baseUrl: config.baseUrl,
        exportTypes: config.exportTypes,
        exportAssets: config.assetsFilename ? true : false,
        fetchAssetDetails: fetchAssetDetails
    });

    const fileService = new FileService();
    const fileProcessorService = new FileProcessorService();

    const response = await exportService.exportAllAsync();

    const itemsZipFileData = await fileProcessorService.createItemsZipAsync(response, {
        itemFormatService: getItemFormatService(config.format)
    });
    await fileService.writeFileAsync(config.itemsFilename, itemsZipFileData);

    if (config.assetsFilename) {
        const assetsZipFileData = await fileProcessorService.createAssetsZipAsync(response, {
            assetFormatService: getAssetFormatService(config.format)
        });
        await fileService.writeFileAsync(config.assetsFilename, assetsZipFileData);
    }

    logDebug({ type: 'info', message: `Completed` });
};

const restoreAsync = async (config: ICliFileConfig) => {
    const fileProcessorService = new FileProcessorService();

    if (!config.apiKey) {
        throw Error(`Missing 'apiKey' configuration option`);
    }

    const fileService = new FileService();

    const importService = new ImportService({
        skipFailedItems: config.skipFailedItems,
        baseUrl: config.baseUrl,
        environmentId: config.environmentId,
        apiKey: config.apiKey,
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

const validateConfig = (config?: ICliFileConfig) => {
    if (!config) {
        throw Error(`Invalid config file`);
    }

    if (!config.format) {
        throw Error(`Please specify 'format'`);
    }

    const environmentId = config.environmentId;
    const action = config.action;

    if (!environmentId) {
        throw Error('Invalid environment id');
    }

    if (!action) {
        throw Error('Invalid action');
    }
};

const run = async () => {
    const config = await getConfig();

    validateConfig(config);

    if (config.action === 'export') {
        await exportAsync(config);
    } else if (config.action === 'restore') {
        await restoreAsync(config);
    } else {
        throw Error(`Invalid action`);
    }
};

const getConfig = async () => {
    let resolvedArgs: { [key: string]: string | unknown } = await argv;
    const configFilename: string = (await resolvedArgs.config) as string;

    if (configFilename) {
        // get config from file
        const configFile = readFileSync(`./${configFilename}`);
        resolvedArgs = JSON.parse(configFile.toString());
    }

    const action: CliAction | undefined = resolvedArgs.action as CliAction | undefined;
    const apiKey: string | undefined = resolvedArgs.apiKey as string | undefined;
    const isSecure: boolean =
        (resolvedArgs.isSecure as string | undefined)?.toString()?.toLowerCase() === 'true'.toLowerCase() ?? true;
    const isPreview: boolean =
        (resolvedArgs.isPreview as string | undefined)?.toString()?.toLowerCase() === 'true'.toLowerCase() ?? true;
    const environmentId: string | undefined = resolvedArgs.environmentId as string | undefined;
    const format: string | undefined = resolvedArgs.format as string | undefined;
    const baseUrl: string | undefined = resolvedArgs.baseUrl as string | undefined;
    const itemsFilename: string | undefined =
        (resolvedArgs.itemsFilename as string | undefined) ?? getDefaultExportFilename('items');
    const assetsFilename: string | undefined = resolvedArgs.assetsFilename as string | undefined;
    const exportTypes: string | undefined = resolvedArgs.exportTypes?.toString() as string | undefined;
    const skipFailedItems: boolean =
        (resolvedArgs.skipFailedItems as string | undefined)?.toString()?.toLowerCase() === 'true'.toLowerCase() ??
        true;
    const fetchAssetDetails: boolean =
        (resolvedArgs.fetchAssetDetails as string | undefined)?.toString()?.toLowerCase() === 'true'.toLowerCase() ??
        false;

    const typesMapped: string[] = exportTypes ? exportTypes.split(',').map((m) => m.trim()) : [];

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

    if (!action) {
        throw Error(`No action was provided`);
    }

    if (!environmentId) {
        throw Error(`Environment id was not provided`);
    }

    // get config from command line
    const config: ICliFileConfig = {
        action,
        apiKey,
        environmentId,
        itemsFilename: itemsFilename,
        assetsFilename: assetsFilename,
        baseUrl,
        exportTypes: typesMapped,
        skipFailedItems: skipFailedItems,
        isPreview: isPreview,
        isSecure: isSecure,
        fetchAssetDetails: fetchAssetDetails,
        format: mappedFormat
    };

    return config;
};

const getDefaultExportFilename = (type: 'items') => {
    const date = new Date();
    return `${type}-export-${date.getDate()}-${
        date.getMonth() + 1
    }-${date.getFullYear()}-${date.getHours()}-${date.getMinutes()}.zip`;
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
