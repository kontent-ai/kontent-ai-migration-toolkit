import { getDefaultLogger, migrateAsync } from '../lib/index.js';

await migrateAsync({
    logger: getDefaultLogger(),
    sourceEnvironment: {
        apiKey: '<key>',
        environmentId: '<id>',
        // array of items to migrate from one environment to another
        items: [
            {
                itemCodename: '<itemCodename>',
                languageCodename: '<languageCodename>'
            }
        ]
    },
    targetEnvironment: {
        apiKey: '<key>',
        environmentId: '<id>'
    }
});
