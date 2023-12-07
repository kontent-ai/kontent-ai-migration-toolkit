import { AssetJsonProcessorService, ItemJsonProcessorService } from '../lib/file-processor/index.js';

import { ExportToolkit } from '../lib/toolkit/export-toolkit.class.js';

const run = async () => {
    const exportToolkit = new ExportToolkit({
        environmentId: '<id>',
        exportAssets: true,
        isPreview: false,
        isSecure: false
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
