import { importAsync, getDefaultNodeLogAsync, extractAsync } from '../lib/index.js';

const log = await getDefaultNodeLogAsync();

// get data from previously stored export (optional)
const data = await extractAsync({
    zipContext: 'node.js',
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
    logger: log,
    data: data,
    adapterConfig: {
        environmentId: '<id>',
        apiKey: '<mapiKey>',
        skipFailedItems: false
    }
});
