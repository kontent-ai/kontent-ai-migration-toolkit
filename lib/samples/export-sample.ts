import { FileProcessorService, JsonProcessorService } from '../file-processor';

import { ExportService } from '../export';
import { FileService } from '../node';

const run = async () => {
    const fileService = new FileService({});

    const zipService = new FileProcessorService();

    const exportService = new ExportService({
        projectId: 'sourceProjectId',
        exportAssets: true
    });

    // data contains entire project content
    const data = await exportService.exportAllAsync();

    // prepare zip file
    const zipFile = await zipService.createZipAsync(data, { formatService: new JsonProcessorService() });

    // save zip to file system (node.js only)
    await fileService.writeFileAsync('filename', zipFile);
};

run();
