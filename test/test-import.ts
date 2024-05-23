import * as dotenv from 'dotenv';
import { confirmImportAsync, getDefaultLog, getEnvironmentRequiredValue, importFromFilesAsync } from '../lib/index.js';
import { getDefaultExportFilename } from 'lib/node/cli/utils/cli.utils.js';

const run = async () => {
    dotenv.config({
        path: '../.env.local'
    });

    const environmentId = getEnvironmentRequiredValue('targetEnvironmentId');
    const apiKey = getEnvironmentRequiredValue('targetApiKey');
    const log = getDefaultLog();

    await confirmImportAsync({
        force: false,
        apiKey: apiKey,
        environmentId: environmentId,
        log: log
    });

    await importFromFilesAsync({
        log: log,
        environmentId: environmentId,
        apiKey: apiKey,
        skipFailedItems: false,
        items: {
            filename: getDefaultExportFilename('items'),
            formatService: 'json'
        },
        assets: {
            filename: getDefaultExportFilename('assets'),
            formatService: 'json'
        }
    });
};

run();