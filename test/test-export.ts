import * as dotenv from 'dotenv';
import { confirmExportAsync, exportAsync, getDefaultLogAsync, handleError, storeAsync } from '../lib/index.js';
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

    const exportData = await exportAsync({
        log: log,
        adapterConfig: {
            environmentId: environmentId,
            apiKey: apiKey,
            exportItems: [
                {
                    itemCodename: getEnvironmentRequiredValue('item'),
                    languageCodename: getEnvironmentRequiredValue('language')
                }
            ]
        }
    });

    await storeAsync({
        data: exportData
    });
};

run().catch((error) => {
    handleError(error);
});
