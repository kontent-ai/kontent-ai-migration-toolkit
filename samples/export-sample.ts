import {
    AssetJsonProcessorService,
    FileProcessorService,
    ItemJsonProcessorService
} from '../lib/file-processor/index.js';

import { ExportService } from '../lib/export/index.js';
import { FileService } from '../lib/node/index.js';

const run = async () => {
    const fileService = new FileService();
    const zipService = new FileProcessorService();

    const exportService = new ExportService({
        environmentId: '<id>',
        exportAssets: true,
        isPreview: false,
        isSecure: false
    });

    // data contains entire project content
    const data = await exportService.exportAllAsync();

    // prepare zip files
    const itemsZipFile = await zipService.createItemsZipAsync(data, {
        itemFormatService: new ItemJsonProcessorService()
    });
    const assetsZipFile = await zipService.createAssetsZipAsync(data, {
        assetFormatService: new AssetJsonProcessorService()
    });

    // save zip to file system (node.js only)
    await fileService.writeFileAsync('items-export', itemsZipFile);
    await fileService.writeFileAsync('assets-export', assetsZipFile);
};

run();
