import { getDefaultLogger, exportAsync, storeAsync } from '../lib/index.js';

const exportData = await exportAsync({
    logger: getDefaultLogger(),
    adapterConfig: {
        environmentId: '<id>',
        apiKey: '<apiKey>',
        exportItems: [
            {
                itemCodename: '<itemCodename>',
                languageCodename: '<languageCodename>'
            }
        ]
    }
});

// stores data on FS for later use
await storeAsync({
    data: exportData,
    files: {
        items: {
            filename: 'items-export.zip',
            format: 'json'
        },
        assets: {
            filename: 'assets-export.zip',
            format: 'json'
        }
    }
});
