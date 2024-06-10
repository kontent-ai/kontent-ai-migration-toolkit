import * as dotenv from 'dotenv';
import { migrateAsync, confirmMigrateAsync, handleError, getDefaultLogger } from '../../lib/index.js';
import { getEnvironmentRequiredValue } from './utils/test.utils.js';

const run = async () => {
    dotenv.config({
        path: '../../.env.local'
    });

    const sourceEnvironmentId = getEnvironmentRequiredValue('sourceEnvironmentId');
    const sourceApiKey = getEnvironmentRequiredValue('sourceApiKey');
    const targetEnvironmentId = getEnvironmentRequiredValue('targetEnvironmentId');
    const targetApiKey = getEnvironmentRequiredValue('targetApiKey');
    const logger = getDefaultLogger();

    await confirmMigrateAsync({
        force: false,
        sourceEnvironment: {
            apiKey: sourceApiKey,
            environmentId: sourceEnvironmentId
        },
        targetEnvironment: {
            apiKey: targetApiKey,
            environmentId: targetEnvironmentId
        },
        logger: logger
    });

    await migrateAsync({
        logger: logger,
        sourceEnvironment: {
            id: sourceEnvironmentId,
            apiKey: sourceApiKey,
            items: [
                {
                    itemCodename: getEnvironmentRequiredValue('item'),
                    languageCodename: getEnvironmentRequiredValue('language')
                }
            ]
        },
        targetEnvironment: {
            id: targetEnvironmentId,
            apiKey: targetApiKey,
            skipFailedItems: false
        }
    });
};

run().catch((error) => {
    handleError(error);
});
