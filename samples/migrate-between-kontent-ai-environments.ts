import { getDefaultLog, migrateAsync } from '../lib/index.js';

await migrateAsync({
    log: getDefaultLog(),
    sourceEnvironment: {
        apiKey: '<key>',
        id: '<id>',
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
