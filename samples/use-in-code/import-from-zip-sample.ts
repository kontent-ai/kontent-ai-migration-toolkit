import { ImportToolkit } from '../../lib/toolkit/import-toolkit.class.js';
import { AssetJsonProcessorService, ItemJsonProcessorService } from '../../lib/file-processor/index.js';

const run = async () => {
    const importToolkit = new ImportToolkit({
        sourceType: 'zip',
        log: (data) => {
            console.log(`${data.type}: ${data.message}`);
        },
        environmentId: '<id>',
        managementApiKey: '<mapiKey>',
        skipFailedItems: false,
        // be careful when filtering data to import because you might break data consistency.
        // for example, it might not be possible to import language variant without first importing content item and so on.
        canImport: {
            asset: (item) => {
                if (item.filename.startsWith('_corporate')) {
                    // asset will be imported only if the title starts with "_corporate"
                    return true;
                }
                // otherwise asset will NOT be imported
                return false;
            },

            contentItem: (item) => true // all content items will be imported,
        },
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

    await importToolkit.importAsync();
};

run();
