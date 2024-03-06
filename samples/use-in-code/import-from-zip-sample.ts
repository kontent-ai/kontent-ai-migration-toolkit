import { ImportToolkit } from '../../lib/toolkit/import-toolkit.class.js';

const run = async () => {
    const importToolkit = new ImportToolkit({
        sourceType: 'zip',
        log: {
            console: (data) => {
                console.log(data.message);
            }
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
            formatService: 'json' // or different one, see readme.md
        },
        assets: {
            filename: 'assets-export.zip',
            formatService: 'json' // or different one, see readme.md
        }
    });

    await importToolkit.importAsync();
};

run();
