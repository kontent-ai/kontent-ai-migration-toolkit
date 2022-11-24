import { FileProcessorService } from 'lib/file-processor';

import { ExportService } from '../export';
import { FileService } from '../node';

const run = async () => {
    const fileService = new FileService({
    });

    const zipService = new FileProcessorService({
        context: 'node.js'
    });

    const exportService = new ExportService({
        projectId: 'sourceProjectId',
        onProcess: item => {
            // called when any content is exported
            console.log(`Exported: ${item.title} | ${item.actionType}`);
        },
        exportAssets: true
    });

    // data contains entire project content
    const data = await exportService.exportAllAsync();

    // prepare zip file
    const zipFile = await zipService.createZipAsync(data);

    // save zip to file system (node.js only)
    await fileService.writeFileAsync('filename', zipFile);

    await zipService.createZipAsync(data);
};

run();
