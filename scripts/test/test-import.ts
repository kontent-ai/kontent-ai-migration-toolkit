import * as dotenv from 'dotenv';
import { confirmImportAsync, extractAsync, getDefaultLogAsync, handleError, importAsync } from '../../lib/index.js';
import { getEnvironmentRequiredValue } from './utils/test.utils.js';

const run = async () => {
    dotenv.config({
        path: '../../.env.local'
    });

    const environmentId = getEnvironmentRequiredValue('targetEnvironmentId');
    const apiKey = getEnvironmentRequiredValue('targetApiKey');
    const log = await getDefaultLogAsync();

    await confirmImportAsync({
        force: false,
        apiKey: apiKey,
        environmentId: environmentId,
        log: log
    });

    const data = await extractAsync({
        files: {
            assets: { filename: 'assets.zip', format: 'json' },
            items: { filename: 'items.zip', format: 'json' }
        }
    });

    await importAsync({
        log: log,
        data: data,
        adapterConfig: {
            environmentId: environmentId,
            apiKey: apiKey,
            skipFailedItems: false
        }
    });
};

run().catch((error) => {
    handleError(error);
});
