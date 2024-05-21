import { importAsync, importFromFilesAsync, getDefaultLog } from '../lib/index.js';

/* Import from previously exported files */
await importFromFilesAsync({
    log: getDefaultLog(),
    environmentId: '<id>',
    apiKey: '<mapiKey>',
    skipFailedItems: false,
    items: {
        filename: 'items-export.json', // or zip
        formatService: 'json'
    },
    assets: {
        filename: 'assets-export.zip', // always a zip
        formatService: 'json'
    }
});

/* Import migration items directly */
await importAsync({
    log: getDefaultLog(),
    environmentId: '<id>',
    apiKey: '<mapiKey>',
    skipFailedItems: false,
    assets: [], // array of `IMigrationAsset` objects
    items: [] // array of `IMigrationItem` objects
});
