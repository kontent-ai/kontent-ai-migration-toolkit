import { importAsync, extractAsync } from '../lib/index.js';

// get data from previously stored export (optional)
const data = await extractAsync({
    filename: 'data.zip'
});

// import data into your Kontent.ai environment
await importAsync({
    data: data,
    environmentId: '<id>',
    apiKey: '<mapiKey>',
    skipFailedItems: false
});
