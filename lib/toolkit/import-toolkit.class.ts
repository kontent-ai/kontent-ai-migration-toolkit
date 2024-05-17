import { AssetsFormatConfig, ItemsFormatConfig, ZipService, getZipService } from '../zip/index.js';
import {
    IFlattenedContentType,
    IMigrationAsset,
    IMigrationItem,
    getFlattenedContentTypesAsync
} from '../core/index.js';
import { IImportConfig, IImportSource, ImportService, getImportService } from '../import/index.js';
import { getAssetsFormatService, getItemsFormatService } from './utils/toolkit.utils.js';
import { FileService, getFileService } from '../file/index.js';

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
    private readonly fileProcessorService: ZipService;
    private readonly fileService: FileService;
    private readonly importService: ImportService;

    constructor(private config: IImportToolkitConfig) {
        this.fileProcessorService = getZipService(config.log);
        this.fileService = getFileService(config.log);
        this.importService = getImportService(this.config);
    }

    async importAsync(data: IImportData): Promise<void> {
        const importSourceData: IImportSource = {
            importData: {
                items: data.items,
                assets: data.assets
            }
        };

        await this.importService.importAsync(importSourceData);
    }

    async importFromFilesAsync(data: IImportFromFilesData): Promise<void> {
        let importSourceData: IImportSource;
        const contentTypes = await getFlattenedContentTypesAsync(
            this.importService.getManagementClient(),
            this.config.log
        );

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

        await this.importService.importAsync(importSourceData);
    }

    private async getImportDataFromNonZipFileAsync(
        data: IImportFromFilesData & {
            contentTypes: IFlattenedContentType[];
        }
    ): Promise<IImportSource> {
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
