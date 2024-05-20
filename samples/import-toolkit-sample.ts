import { ImportToolkit, getDefaultLog } from '../lib/index.js';

const importToolkit = new ImportToolkit({
    sourceType: 'file', // or zip
    log: getDefaultLog(),
    environmentId: '<id>',
    managementApiKey: '<mapiKey>',
    skipFailedItems: false
});


/* Import from previously exported files */
await importToolkit.importFromFilesAsync({
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
await importToolkit.importAsync({
    assets: [], // array of `IMigrationAsset` objects
    items: [] // array of `IMigrationItem` objects
});
