import { getDefaultLog, migrateAsync } from '../lib/index.js';

await migrateAsync({
    log: getDefaultLog(),
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
