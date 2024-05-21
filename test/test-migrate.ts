import * as dotenv from 'dotenv';
import { migrateAsync, confirmMigrateAsync, getDefaultLog, getEnvironmentRequiredValue } from '../lib/index.js';

const run = async () => {
    dotenv.config({
        path: '../.env.local'
    });

    const sourceEnvironmentId = getEnvironmentRequiredValue('sourceEnvironmentId');
    const sourceApiKey = getEnvironmentRequiredValue('sourceApiKey');
    const targetEnvironmentId = getEnvironmentRequiredValue('targetEnvironmentId');
    const targetApiKey = getEnvironmentRequiredValue('targetApiKey');
    const log = getDefaultLog();

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
        log: log
    });

    await migrateAsync({
        log: log,
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

run();
