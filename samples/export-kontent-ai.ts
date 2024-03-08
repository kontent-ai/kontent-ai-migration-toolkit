import { getDefaultLog } from '../lib/core/index.js';
import { KontentAiExportAdapter } from '../lib/export/index.js';
import { ExportToolkit } from '../lib/toolkit/index.js';

const run = async () => {
    const adapter = new KontentAiExportAdapter({
        environmentId: '<id>',
        managementApiKey: '<apiKey>',
        isPreview: false,
        isSecure: false,
        // optional filter to customize what items are exported
        customItemsExport: async (client) => {
            // return only the items you want to export by applying filters, parameters etc..
            const response = await client.items().equalsFilter('elements.category', 'scifi').toAllPromise();
            return response.data.items;
        },
        log: getDefaultLog()
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
