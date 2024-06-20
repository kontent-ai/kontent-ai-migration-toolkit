import { getDefaultLogger, exportAsync, storeAsync } from '../lib/index.js';

const exportData = await exportAsync({
    logger: getDefaultLogger(),
    environmentId: '<id>',
    apiKey: '<apiKey>',
    exportItems: [
        {
            itemCodename: '<itemCodename>',
            languageCodename: '<languageCodename>'
        }
    ]
});

// stores data on FS for later use
await storeAsync({
    data: exportData,
    filename: 'data.zip'
});
