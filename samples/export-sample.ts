import { getDefaultLog, DefaultExportAdapter, exportAsync } from '../lib/index.js';

const log = getDefaultLog();

await exportAsync({
    adapter: new DefaultExportAdapter({
        environmentId: '<id>',
        apiKey: '<apiKey>',
        log: log,
        exportItems: [
            {
                itemCodename: '<itemCodename>',
                languageCodename: '<languageCodename>'
            }
        ]
    }),
    log: log,
    items: {
        filename: 'items-export.zip',
        formatService: 'json' // or different one, see readme.md
    },
    // assets are optional
    assets: {
        filename: 'assets-export.zip',
        formatService: 'json' // or different one, see readme.md
    }
});
