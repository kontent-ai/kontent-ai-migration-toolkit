import { getDefaultNodeLogAsync, migrateAsync } from '../lib/index.js';

await migrateAsync({
    logger: await getDefaultNodeLogAsync(),
    sourceEnvironment: {
        apiKey: '<key>',
        id: '<id>',
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
        id: '<id>'
    }
});
