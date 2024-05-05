import { getDefaultLog, KontentAiExportAdapter, ExportToolkit } from '../lib/index.js';

const run = async () => {
    const adapter = new KontentAiExportAdapter({
        environmentId: '<id>',
        managementApiKey: '<apiKey>',
        log: getDefaultLog(),
        exportItems: [
            {
                itemCodename: '<itemCodename>',
                languageCodename: '<languageCodename>'
            }
        ]
    });

    const exportToolkit = new ExportToolkit({
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

    await exportToolkit.exportAsync();
};

run();
