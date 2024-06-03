import * as dotenv from 'dotenv';
import { confirmExportAsync, exportAsync, getDefaultExportAdapter, getDefaultLogAsync } from '../lib/index.js';
import { getEnvironmentRequiredValue } from './utils/environment.utils.js';

const run = async () => {
    dotenv.config({
        path: '../.env.local'
    });

    const environmentId = getEnvironmentRequiredValue('sourceEnvironmentId');
    const apiKey = getEnvironmentRequiredValue('sourceApiKey');
    const log = await getDefaultLogAsync();

    await confirmExportAsync({
        force: false,
        apiKey: apiKey,
        environmentId: environmentId,
        log: log
    });

    const adapter = getDefaultExportAdapter({
        environmentId: environmentId,
        apiKey: apiKey,
        log: log,
        exportItems: [
            {
                itemCodename: getEnvironmentRequiredValue('item'),
                languageCodename: getEnvironmentRequiredValue('language')
            }
        ]
    });

    await exportAsync({
        log: log,
        adapter,
        items: {
            filename: 'items-export.zip',
            formatService: 'json'
        },
        assets: {
            filename: 'assets-export.zip',
            formatService: 'json'
        }
    });
};

run();
