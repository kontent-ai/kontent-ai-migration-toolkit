import * as dotenv from 'dotenv';
import { confirmExportAsync, exportAsync, handleError, storeAsync, getDefaultLogger } from '../../lib/index.js';
import { getEnvironmentRequiredValue } from './utils/test.utils.js';

const run = async () => {
    dotenv.config({
        path: '../../.env.local'
    });

    const environmentId = getEnvironmentRequiredValue('sourceEnvironmentId');
    const apiKey = getEnvironmentRequiredValue('sourceApiKey');
    const logger = getDefaultLogger();

    await confirmExportAsync({
        force: false,
        apiKey: apiKey,
        environmentId: environmentId,
        logger: logger
    });

    const exportData = await exportAsync({
        logger: logger,
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
        data: exportData,
        files: {
            assets: { filename: 'assets.zip', format: 'json' },
            items: { filename: 'items.zip', format: 'json' }
        }
    });
};

run().catch((error) => {
    handleError(error);
});
