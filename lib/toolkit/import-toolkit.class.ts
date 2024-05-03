import {
    AssetsFormatConfig,
    IFlattenedContentType,
    IMigrationAsset,
    IMigrationItem,
    ItemsFormatConfig,
    getAssetsFormatService,
    getFlattenedContentTypesAsync,
    getItemsFormatService
} from '../core/index.js';
import { FileProcessorService, getFileProcessorService } from '../file-processor/index.js';
import { IImportConfig, IImportSource, ImportService } from '../import/index.js';
import { FileService, getFileService } from '../node/index.js';

export interface IImportToolkitConfig extends IImportConfig {}

export interface IImportData {
    items: IMigrationItem[];
    assets: IMigrationAsset[];
}

export interface IImportFromFilesData {
    items?: {
        filename: string;
        formatService: ItemsFormatConfig;
    };
    assets?: {
        filename: string;
        formatService: AssetsFormatConfig;
    };
}

export class ImportToolkit {
    private readonly fileProcessorService: FileProcessorService;
    private readonly fileService: FileService;

    constructor(private config: IImportToolkitConfig) {
        this.fileProcessorService = getFileProcessorService(config.log);
        this.fileService = getFileService(config.log);
    }

    async importAsync(data: IImportData): Promise<void> {
        const importService = new ImportService(this.config);

        const importSourceData: IImportSource = {
            importData: {
                items: data.items,
                assets: data.assets
            }
        };

        await importService.importAsync(importSourceData);
    }

    async importFromFilesAsync(data: IImportFromFilesData): Promise<void> {
        const importService = new ImportService(this.config);
        let importSourceData: IImportSource;

        // prepare content types
        const contentTypes = await getFlattenedContentTypesAsync(importService.managementClient, this.config.log);

        switch (this.config.sourceType) {
            case 'zip': {
                importSourceData = await this.getImportDataFromZipAsync({
                    ...data,
                    contentTypes: contentTypes
                });
                break;
            }
            case 'file': {
                importSourceData = await this.getImportDataFromNonZipFileAsync({
                    ...data,
                    contentTypes: contentTypes
                });
                break;
            }
            default: {
                throw Error(`Unsupported import type '${this.config.sourceType}'`);
            }
        }

        await importService.importAsync(importSourceData);
    }

    private async getImportDataFromNonZipFileAsync(
        data: IImportFromFilesData & {
            contentTypes: IFlattenedContentType[];
        }
    ): Promise<IImportSource> {
        // parse data from files
        const importSourceData = await this.fileProcessorService.parseFileAsync({
            items: data.items
                ? {
                      file: await this.fileService.loadFileAsync(data.items.filename),
                      formatService: getItemsFormatService(data.items.formatService)
                  }
                : undefined,
            assets: data.assets
                ? {
                      file: await this.fileService.loadFileAsync(data.assets.filename),
                      formatService: getAssetsFormatService(data.assets.formatService)
                  }
                : undefined,
            types: data.contentTypes
        });

        return importSourceData;
    }

    private async getImportDataFromZipAsync(
        data: IImportFromFilesData & { contentTypes: IFlattenedContentType[] }
    ): Promise<IImportSource> {
        // parse data from zip
        const importSourceData = await this.fileProcessorService.parseZipAsync({
            items: data.items
                ? {
                      file: await this.fileService.loadFileAsync(data.items.filename),
                      formatService: getItemsFormatService(data.items.formatService)
                  }
                : undefined,
            assets: data.assets
                ? {
                      file: await this.fileService.loadFileAsync(data.assets.filename),
                      formatService: getAssetsFormatService(data.assets.formatService)
                  }
                : undefined,
            types: data.contentTypes
        });

        return importSourceData;
    }
}
