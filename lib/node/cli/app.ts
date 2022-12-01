#!/usr/bin/env node
import { readFileSync } from 'fs';
import * as yargs from 'yargs';

import { ICliFileConfig, CliAction, getExtension } from '../../core';
import { ExportService } from '../../export';
import { ImportService } from '../../import';
import {
    CsvProcessorService,
    ExportFormat,
    FileProcessorService,
    IFormatService,
    JsonProcessorService
} from '../../file-processor';
import { SharedModels } from '@kontent-ai/management-sdk';
import { FileService } from '../file/file.service';
import { green, red, yellow } from 'colors';

const argv = yargs(process.argv.slice(2))
    .example(
        'csvm --action=backup --format=csv|json --apiKey=xxx --projectId=xxx',
        'Creates zip backup of Kontent.ai project'
    )
    .example(
        'csvm --action=restore --apiKey=xxx --projectId=xxx --filename=backupFile',
        'Read given zip file and recreates data in Kontent.ai project'
    )
    .alias('p', 'projectId')
    .describe('p', 'ProjectId')
    .alias('ak', 'apiKey')
    .describe('ak', 'Management API Key')
    .alias('sk', 'secureApiKey')
    .describe('sk', 'API Key required when Delivery API has secure access enabled')
    .alias('pk', 'previewApiKey')
    .describe('pk', 'Use if you want to export data using Preview API')
    .alias('a', 'action')
    .describe('a', 'Action to perform. One of: "backup" | "restore"')
    .alias('f', 'filename')
    .describe('f', 'Name of file to export / restore')
    .alias('of', 'format')
    .describe('of', 'Format of the export. One of: "csv" | "json"')
    .alias('b', 'baseUrl')
    .describe('b', 'Custom base URL for Management API calls.')
    .alias('sfi', 'skipFailedItems')
    .describe('sfi', 'Indicates whether import should skip items that fail to import and cotinue with next item')
    .alias('et', 'exportTypes')
    .describe(
        'et',
        'Can be used to export only selected content types. Expects CSV of type codenames. If not provided, all content items of all types are exported'
    )
    .alias('ea', 'exportAssets')
    .describe('at', 'Indicated if assets should be exported. Supported values are "true" | "false"')
    .help('h')
    .alias('h', 'help').argv;

const jsonFormatService = new JsonProcessorService();
const csvFormatService = new CsvProcessorService();

const backupAsync = async (config: ICliFileConfig) => {
    const exportService = new ExportService({
        projectId: config.projectId,
        apiKey: config.apiKey,
        previewApiKey: config.previewApiKey,
        secureApiKey: config.secureApiKey,
        baseUrl: config.baseUrl,
        exportTypes: config.exportTypes,
        exportAssets: config.exportAssets,
        fetchAssetDetails: config.fetchAssetDetails,
        onProcess: (item) => {
            console.log(`Exported ${item.title} | ${green(item.data.system.type)}`);
        }
    });

    const fileService = new FileService({});

    const fileProcessorService = new FileProcessorService({
        context: 'node.js'
    });

    const response = await exportService.exportAllAsync();

    let formatService: IFormatService;
    if (config.format === 'csv') {
        formatService = csvFormatService;
    } else if (config.format === 'json') {
        formatService = jsonFormatService;
    } else {
        throw Error(`Unsupported export format '${config.format}'`);
    }

    const zipFileData = await fileProcessorService.createZipAsync(response, formatService);

    await fileService.writeFileAsync(config.filename, zipFileData);

    console.log(green('Completed'));
};

const restoreAsync = async (config: ICliFileConfig) => {
    const fileProcessorService = new FileProcessorService({
        context: 'node.js'
    });

    if (!config.apiKey) {
        throw Error(`Missing 'apiKey' configuration option`);
    }

    const fileService = new FileService({});

    const importService = new ImportService({
        onProcess: (item) => {
            console.log(`${yellow(item.title)} | ${green(item.itemType)} | ${item.actionType}`);
        },
        skipFailedItems: config.skipFailedItems,
        baseUrl: config.baseUrl,
        projectId: config.projectId,
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

    const file = await fileService.loadFileAsync(config.filename);
    const fileExtension = getExtension(config.filename);

    if (fileExtension?.endsWith('zip')) {
        const data = await fileProcessorService.extractZipAsync(file);
        await importService.importFromSourceAsync(data);
    } else if (fileExtension?.endsWith('csv')) {
        const data = await fileProcessorService.extractCsvFileAsync(file);
        await importService.importFromSourceAsync(data);
    } else if (fileExtension?.endsWith('json')) {
        const data = await fileProcessorService.extractJsonFileAsync(file);
        await importService.importFromSourceAsync(data);
    } else {
        throw Error(`Unsupported file type '${fileExtension}'`);
    }

    console.log(green('Completed'));
};

const validateConfig = (config?: ICliFileConfig) => {
    if (!config) {
        throw Error(`Invalid config file`);
    }

    const projectId = config.projectId;
    const action = config.action;

    if (!projectId) {
        throw Error('Invalid project id');
    }

    if (!action) {
        throw Error('Invalid action');
    }
};

const run = async () => {
    const config = await getConfig();

    validateConfig(config);

    if (config.action === 'backup') {
        await backupAsync(config);
    } else if (config.action === 'restore') {
        await restoreAsync(config);
    } else {
        throw Error(`Invalid action`);
    }
};

const getConfig = async () => {
    const resolvedArgs = await argv;
    const configFilename: string = (await resolvedArgs.config) as string;

    if (configFilename) {
        // get config from file
        const configFile = readFileSync(`./${configFilename}`);

        return JSON.parse(configFile.toString()) as ICliFileConfig;
    }

    const action: CliAction | undefined = resolvedArgs.action as CliAction | undefined;
    const apiKey: string | undefined = resolvedArgs.apiKey as string | undefined;
    const secureApiKey: string | undefined = resolvedArgs.secureApiKey as string | undefined;
    const previewApiKey: string | undefined = resolvedArgs.previewApiKey as string | undefined;
    const projectId: string | undefined = resolvedArgs.projectId as string | undefined;
    const format: string | undefined = resolvedArgs.format as string | undefined;
    const baseUrl: string | undefined = resolvedArgs.baseUrl as string | undefined;
    const filename: string | undefined = (resolvedArgs.filename as string | undefined) ?? getDefaultBackupFilename();
    const exportTypes: string | undefined = resolvedArgs.exportTypes as string | undefined;
    const exportAssets: boolean =
        (resolvedArgs.exportAssets as string | undefined)?.toLowerCase() === 'true'.toLowerCase() ?? true;
    const skipFailedItems: boolean =
        (resolvedArgs.skipFailedItems as string | undefined)?.toLowerCase() === 'true'.toLowerCase() ?? true;
    const fetchAssetDetails: boolean =
        (resolvedArgs.fetchAssetDetails as string | undefined)?.toLowerCase() === 'true'.toLowerCase() ?? false;

    const typesMapped: string[] = exportTypes ? exportTypes.split(',').map((m) => m.trim()) : [];

    let mappedFormat: ExportFormat = 'csv';

    if (format?.toLowerCase() === 'csv') {
        mappedFormat = 'csv';
    } else if (format?.toLowerCase() === 'json') {
        mappedFormat = 'json';
    } else {
        if (action === 'backup') {
            throw Error(`Unsupported export format '${format}'`);
        }
    }

    if (!action) {
        throw Error(`No action was provided`);
    }

    if (!projectId) {
        throw Error(`Project id was not provided`);
    }

    // get config from command line
    const config: ICliFileConfig = {
        action,
        apiKey,
        projectId,
        filename: filename,
        baseUrl,
        exportTypes: typesMapped,
        exportAssets: exportAssets,
        skipFailedItems: skipFailedItems,
        previewApiKey: previewApiKey,
        secureApiKey: secureApiKey,
        fetchAssetDetails: fetchAssetDetails,
        format: mappedFormat
    };

    return config;
};

const getDefaultBackupFilename = () => {
    const date = new Date();
    return `csv-backup-${date.getDate()}-${
        date.getMonth() + 1
    }-${date.getFullYear()}-${date.getHours()}-${date.getMinutes()}.zip`;
};

run()
    .then((m) => {})
    .catch((err) => {
        if (err instanceof SharedModels.ContentManagementBaseKontentError) {
            console.log(`Management API error occured:`, red(err.message));
            for (const validationError of err.validationErrors) {
                console.log(validationError.message);
            }
        } else {
            console.log(`There was an error processing your request: `, red(err));
        }
    });
