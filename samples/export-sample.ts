import { getDefaultLog, KontentAiExportAdapter, exportAsync } from '../lib/index.js';

const adapter = new KontentAiExportAdapter({
    environmentId: '<id>',
    apiKey: '<apiKey>',
    log: getDefaultLog(),
    exportItems: [
        {
            itemCodename: '<itemCodename>',
            languageCodename: '<languageCodename>'
        }
    ]
});

await exportAsync({
    adapter,
    log: getDefaultLog(),
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
