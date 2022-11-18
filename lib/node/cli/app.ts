#!/usr/bin/env node
import { readFileSync } from 'fs';
import * as yargs from 'yargs';

import { CleanService } from '../../clean';
import { ICliFileConfig, CliAction } from '../../core';
import { ExportService } from '../../export';
import { ImportService } from '../../import';
import { ZipService } from '../../zip';
import { SharedModels } from '@kontent-ai/management-sdk';
import { FileService } from '../file/file.service';
import { green, red, yellow } from 'colors';

const argv = yargs(process.argv.slice(2))
    .example('kbm --action=backup --apiKey=xxx --projectId=xxx', 'Creates zip backup of Kontent.ai project')
    .example(
        'kbm --action=restore --apiKey=xxx --projectId=xxx --zipFilename=backupFile',
        'Read given zip file and recreates data in Kontent.ai project'
    )
    .example(
        'kbm --action=clean --apiKey=xxx --projectId=xxx',
        'Deletes data from given Kontent.ai project. Use with care, this action is not reversible.'
    )
    .alias('p', 'projectId')
    .describe('p', 'ProjectId')
    .alias('k', 'apiKey')
    .describe('k', 'Management API Key')
    .alias('a', 'action')
    .describe('a', 'Action to perform. One of: backup, restore & clean')
    .alias('z', 'zipFilename')
    .describe('z', 'Name of zip used for export / restore')
    .alias('l', 'enableLog')
    .describe('l', 'Indicates if default logging is enabled (useful to indicate progress)')
    .alias('b', 'baseUrl')
    .describe('b', 'Custom base URL for Management API calls.')
    .alias('s', 'preserveWorkflow')
    .describe('s', 'Indicates if workflow information of language variants is preserved')
    .alias('t', 'types')
    .describe(
        't',
        'Can be used to export only selected content types. Expects CSV of type codenames. If not provided, all content items of all types are exported'
    )
    .help('h')
    .alias('h', 'help').argv;

const backupAsync = async (config: ICliFileConfig) => {
    const exportService = new ExportService({
        apiKey: config.apiKey,
        projectId: config.projectId,
        baseUrl: config.baseUrl,
        exportFilter: config.exportFilter,
        onExport: (item) => {
            if (config.enableLog) {
                console.log(`Exported ${yellow(item.title)} | ${green(item.data.system.type)}`);
            }
        }
    });

    const fileService = new FileService({
        enableLog: config.enableLog
    });

    const zipService = new ZipService({
        enableLog: config.enableLog,
        context: 'node.js'
    });

    const response = await exportService.exportAllAsync();
    const zipFileData = await zipService.createZipAsync(response);

    await fileService.writeFileAsync(config.zipFilename, zipFileData);

    console.log(green('Completed'));
};

const cleanAsync = async (config: ICliFileConfig) => {
    const cleanService = new CleanService({
        onDelete: (item) => {
            if (config.enableLog) {
                console.log(`Deleted: ${yellow(item.title)}`);
            }
        },
        baseUrl: config.baseUrl,
        projectId: config.projectId,
        apiKey: config.apiKey
    });

    await cleanService.cleanAllAsync();

    console.log(green('Completed'));
};

const restoreAsync = async (config: ICliFileConfig) => {
    const zipService = new ZipService({
        enableLog: config.enableLog,
        context: 'node.js'
    });

    const fileService = new FileService({
        enableLog: config.enableLog
    });

    const importService = new ImportService({
        onImport: (item) => {
            if (config.enableLog) {
                console.log(`${yellow(item.title)} | ${green(item.itemType)} | ${item.actionType}`);
            }
        },
        preserveWorkflow: config.preserveWorkflow,
        baseUrl: config.baseUrl,
        fixLanguages: true,
        projectId: config.projectId,
        apiKey: config.apiKey,
        enableLog: config.enableLog,
        workflowIdForImportedItems: undefined,
        canImport: {
            contentItem: (item) => {
                return true;
            }
        }
    });

    const file = await fileService.loadFileAsync(config.zipFilename);

    const data = await zipService.extractZipAsync(file);

    await importService.importFromSourceAsync(data);

    console.log(green('Completed'));
};

const validateConfig = (config?: ICliFileConfig) => {
    if (!config) {
        throw Error(`Invalid config file`);
    }

    const projectId = config.projectId;
    const apiKey = config.apiKey;
    const action = config.action;

    if (!projectId) {
        throw Error('Invalid project id');
    }

    if (!apiKey) {
        throw Error('Invalid api key');
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
    } else if (config.action === 'clean') {
        await cleanAsync(config);
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
    const enableLog: boolean | undefined = (resolvedArgs.enableLog as boolean | undefined) ?? true;
    const preserveWorkflow: boolean | undefined = (resolvedArgs.preserveWorkflow as boolean | undefined) ?? true;
    const skipValidation: boolean = (resolvedArgs.skipValidation as boolean | undefined) ?? false;
    const projectId: string | undefined = resolvedArgs.projectId as string | undefined;
    const baseUrl: string | undefined = resolvedArgs.baseUrl as string | undefined;
    const zipFilename: string | undefined =
        (resolvedArgs.zipFilename as string | undefined) ?? getDefaultBackupFilename();
    const types: string | undefined = resolvedArgs.exportFilter as string | undefined;

    const typesMapped: string[] = types ? types.split(',').map((m) => m.trim()) : [];

    if (!action) {
        throw Error(`No action was provided`);
    }

    if (!apiKey) {
        throw Error(`Api key was not provided`);
    }

    if (!projectId) {
        throw Error(`Project id was not provided`);
    }

    // get config from command line
    const config: ICliFileConfig = {
        preserveWorkflow,
        action,
        apiKey,
        enableLog,
        projectId,
        zipFilename,
        baseUrl,
        exportFilter: {
            types: typesMapped
        },
        skipValidation
    };

    return config;
};

const getDefaultBackupFilename = () => {
    const date = new Date();
    return `kontent-backup-${date.getDate()}-${
        date.getMonth() + 1
    }-${date.getFullYear()}-${date.getHours()}-${date.getMinutes()}`;
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
