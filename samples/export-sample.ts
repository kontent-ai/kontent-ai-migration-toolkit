import { getDefaultLogAsync, exportAsync, storeAsync } from '../lib/index.js';

const log = await getDefaultLogAsync();

const exportData = await exportAsync({
    log: log,
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
            formatService: 'json'
        },
        assets: {
            filename: 'assets-export.zip',
            formatService: 'json'
        }
    }
});
