import { ImportService } from 'lib';
import { FileProcessorService } from '../file-processor';
import { FileService } from '../node';

const run = async () => {
    const zipService = new FileProcessorService({
        context: 'node.js'
    });

    const fileService = new FileService({});

    const importService = new ImportService({
        onProcess: (item) => {
            // called when any content is imported
            console.log(`Imported: ${item.title} | ${item.actionType}`);
        },
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

            contentItem: (item) => true // all content items will be imported
        },
        projectId: 'targetProjectId',
        apiKey: 'targetProjectId',
        skipFailedItems: false,
    });

    // read file
    const file = fileService.loadFileAsync('fileName');

    // extract file
    const data = await zipService.extractZipAsync(file);

    // restore into target project
    await importService.importFromSourceAsync(data);
};

run();
