import { FileProcessorService, IAssetFormatService, IItemFormatService } from '../file-processor/index.js';
import { IImportConfig, ImportService } from '../import/index.js';
import { FileService } from '../node/index.js';

export interface IImportToolkitConfig extends IImportConfig {
    items?: {
        filename: string;
        formatService: IItemFormatService;
    };
    assets?: {
        filename: string;
        formatService: IAssetFormatService;
    };
}

export class ImportToolkit {
    private readonly fileProcessorService = new FileProcessorService();
    private readonly fileService = new FileService();

    constructor(private config: IImportToolkitConfig) {}

    async importFromFileAsync(): Promise<void> {
        const importService = new ImportService(this.config);

        // prepare content types
        const contentTypes = await importService.getImportContentTypesAsync();

        // parse data from files
        const data = await this.fileProcessorService.parseFileAsync({
            items: this.config.items
                ? {
                      file: await this.fileService.loadFileAsync(this.config.items.filename),
                      formatService: this.config.items.formatService
                  }
                : undefined,
            assets: this.config.assets
                ? {
                      file: await this.fileService.loadFileAsync(this.config.assets.filename),
                      formatService: this.config.assets.formatService
                  }
                : undefined,
            types: contentTypes
        });

        // import into target environment
        await importService.importAsync(data);
    }

    async importFromZipAsync(): Promise<void> {
        const importService = new ImportService(this.config);

        // prepare content types
        const contentTypes = await importService.getImportContentTypesAsync();

        // parse data from zip
        const data = await this.fileProcessorService.parseZipAsync({
            items: this.config.items
                ? {
                      file: await this.fileService.loadFileAsync(this.config.items.filename),
                      formatService: this.config.items.formatService
                  }
                : undefined,
            assets: this.config.assets
                ? {
                      file: await this.fileService.loadFileAsync(this.config.assets.filename),
                      formatService: this.config.assets.formatService
                  }
                : undefined,
            types: contentTypes
        });

        // import into target environment
        await importService.importAsync(data);
    }
}
