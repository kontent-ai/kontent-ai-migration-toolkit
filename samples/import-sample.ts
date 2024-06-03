import { importAsync, importFromFilesAsync, getDefaultLogAsync, DefaultImportAdapter } from '../lib/index.js';

const log = await getDefaultLogAsync();
const adapter = new DefaultImportAdapter({
    environmentId: '<id>',
    apiKey: '<mapiKey>',
    skipFailedItems: false,
    log: log
});

/* Import from previously exported files */
await importFromFilesAsync({
    adapter: adapter,
    log: log,
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
    adapter: adapter,
    assets: [], // array of `IMigrationAsset` objects
    items: [] // array of `IMigrationItem` objects
});
