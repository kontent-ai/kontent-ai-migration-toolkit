import { ImportToolkit } from '../lib/toolkit/import-toolkit.class.js';
import { ItemCsvProcessorService } from '../lib/file-processor/index.js';

const run = async () => {
    const importToolkit = new ImportToolkit({
        environmentId: '<id>',
        managementApiKey: '<mapiKey>',
        skipFailedItems: false,
        // be careful when filtering data to import because you might break data consistency.
        // for example, it might not be possible to import language variant without first importing content item and so on.
        canImport: {
            asset: (item) => true, // all assets will be imported
            contentItem: (item) => true // all content items will be imported,
        },
        items: {
            filename: 'items-export.csv',
            formatService: new ItemCsvProcessorService()
        }
    });

    await importToolkit.importFromFileAsync();
};

run();
