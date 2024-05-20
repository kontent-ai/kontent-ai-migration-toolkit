import * as dotenv from 'dotenv';
import {
    ExportToolkit,
    KontentAiExportAdapter,
    confirmExportAsync,
    getDefaultLog,
    getEnvironmentRequiredValue
} from '../lib/index.js';

const run = async () => {
    dotenv.config({
        path: '../.env.local'
    });

    const environmentId = getEnvironmentRequiredValue('sourceEnvironmentId');
    const apiKey = getEnvironmentRequiredValue('sourceApiKey');
    const log = getDefaultLog();

    await confirmExportAsync({
        force: false,
        apiKey: apiKey,
        environmentId: environmentId,
        log: log
    });

    const adapter = new KontentAiExportAdapter({
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

    const exportToolkit = new ExportToolkit({
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

    await exportToolkit.exportAsync();
};

run();
