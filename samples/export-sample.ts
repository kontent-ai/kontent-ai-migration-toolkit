import { AssetJsonProcessorService, FileProcessorService, ItemJsonProcessorService } from '../lib/file-processor';

import { ExportService } from '../lib/export';
import { FileService } from '../lib/node';

const run = async () => {
    const fileService = new FileService();
    const zipService = new FileProcessorService();

    const exportService = new ExportService({
        environmentId: 'environmentId',
        exportAssets: true
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
    await fileService.writeFileAsync('items-backup', itemsZipFile);
    await fileService.writeFileAsync('assets-backup', assetsZipFile);
};

run();
