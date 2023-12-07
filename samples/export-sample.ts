import { AssetJsonProcessorService, ItemJsonProcessorService } from '../lib/file-processor/index.js';

import { ExportToolkit } from '../lib/toolkit/export-toolkit.class.js';

const run = async () => {
    const exportToolkit = new ExportToolkit({
        environmentId: '<id>',
        exportAssets: true,
        isPreview: false,
        isSecure: false,
        // optional filter to customize what items are exported
        customItemsExport: async (client) => {
            // return only the items you want to export by applying filters, parameters etc..
            const response = await client.items().equalsFilter('elements.category', 'scifi').toAllPromise();
            return response.data.items;
        }
    });

    await exportToolkit.exportAsync({
        items: {
            filename: 'items-export.zip',
            formatService: new ItemJsonProcessorService() // or different one, see readme.md
        },
        // assets are optional
        assets: {
            filename: 'assets-export.zip',
            formatService: new AssetJsonProcessorService() // or different one, see readme.md
        }
    });
};

run();
