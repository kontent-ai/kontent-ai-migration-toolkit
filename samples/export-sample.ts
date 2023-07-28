import { FileProcessorService, ItemJsonProcessorService } from '../lib/file-processor';

import { ExportService } from '../lib/export';
import { FileService } from '../lib/node';

const run = async () => {
    const fileService = new FileService();
    const zipService = new FileProcessorService();

    const exportService = new ExportService({
        environmentId: 'sourceenvironmentId',
        exportAssets: true
    });

    // data contains entire project content
    const data = await exportService.exportAllAsync();

    // prepare zip file
    const zipFile = await zipService.createZipAsync(data, { itemFormatService: new ItemJsonProcessorService() });

    // save zip to file system (node.js only)
    await fileService.writeFileAsync('filename', zipFile);
};

run();
