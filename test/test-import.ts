import * as dotenv from 'dotenv';
import { ImportToolkit, confirmImportAsync, getDefaultLog, getEnvironmentRequiredValue } from '../lib/index.js';
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

    const importToolkit = new ImportToolkit({
        log: log,
        environmentId: environmentId,
        managementApiKey: apiKey,
        skipFailedItems: false
    });

    await importToolkit.importFromFilesAsync({
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
