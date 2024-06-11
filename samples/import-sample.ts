import { importAsync, extractAsync } from '../lib/index.js';

// get data from previously stored export (optional)
const data = await extractAsync({
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

// import data into your Kontent.ai environment
await importAsync({
    data: data,
    adapterConfig: {
        environmentId: '<id>',
        apiKey: '<mapiKey>',
        skipFailedItems: false
    }
});
