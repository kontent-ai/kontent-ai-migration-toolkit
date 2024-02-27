import { FileProcessorService, IAssetFormatService, IItemFormatService } from '../file-processor/index.js';
import { IImportConfig, IImportContentType, IImportSource, ImportService } from '../import/index.js';
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

    async importAsync(): Promise<void> {
        const importService = new ImportService(this.config);
        let importSourceData: IImportSource;

        // prepare content types
        const contentTypes = await importService.getImportContentTypesAsync();

        switch (this.config.sourceType) {
            case 'zip': {
                importSourceData = await this.getImportDataFromZipAsync({
                    contentTypes: contentTypes
                });
                break;
            }
            case 'file': {
                importSourceData = await this.getImportDataFromFileAsync({
                    contentTypes: contentTypes
                });
                break;
            }
            default: {
                throw Error(`Unsupported import type '${this.config.sourceType}'`);
            }
        }

        // import into target environment
        await importService.importAsync(importSourceData);
    }

    private async getImportDataFromFileAsync(data: { contentTypes: IImportContentType[] }): Promise<IImportSource> {
        // parse data from files
        const importSourceData = await this.fileProcessorService.parseFileAsync({
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
            types: data.contentTypes
        });

        return importSourceData;
    }

    private async getImportDataFromZipAsync(data: { contentTypes: IImportContentType[] }): Promise<IImportSource> {
        // parse data from zip
        const importSourceData = await this.fileProcessorService.parseZipAsync({
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
            types: data.contentTypes
        });

        return importSourceData;
    }
}
