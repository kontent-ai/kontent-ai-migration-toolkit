import { AssetsFormatConfig, ItemsFormatConfig, getZipService } from '../zip/index.js';
import { IMigrationAsset, IMigrationItem, getFlattenedContentTypesAsync } from '../core/index.js';
import { IImportConfig, IImportSource, getImportService } from '../import/index.js';
import { getAssetsFormatService, getItemsFormatService } from './utils/toolkit.utils.js';
import { getFileService } from '../file/index.js';

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

export async function importAsync(data: IImportData & IImportConfig): Promise<void> {
    await getImportService(data).importAsync(data);
}

export async function importFromFilesAsync(data: IImportFromFilesData & IImportConfig): Promise<void> {
    await getImportService(data).importAsync(await getSourceDataAsync(data));
}

async function getSourceDataAsync(data: IImportFromFilesData & IImportConfig): Promise<IImportSource> {
    if (data?.items?.filename?.toLowerCase()?.endsWith('.zip')) {
        return await getImportDataFromZipAsync(data);
    }

    return await getImportDataFromNonZipFileAsync(data);
}

async function getImportDataFromZipAsync(data: IImportFromFilesData & IImportConfig): Promise<IImportSource> {
    const fileService = getFileService(data.log);
    const fileProcessorService = getZipService(data.log);

    const importSourceData = await fileProcessorService.parseZipAsync({
        items: data.items
            ? {
                  file: await fileService.loadFileAsync(data.items.filename),
                  formatService: getItemsFormatService(data.items.formatService)
              }
            : undefined,
        assets: data.assets
            ? {
                  file: await fileService.loadFileAsync(data.assets.filename),
                  formatService: getAssetsFormatService(data.assets.formatService)
              }
            : undefined,
        types: await getFlattenedContentTypesAsync(getImportService(data).getManagementClient(), data.log)
    });

    return importSourceData;
}

async function getImportDataFromNonZipFileAsync(data: IImportFromFilesData & IImportConfig): Promise<IImportSource> {
    const fileService = getFileService(data.log);
    const fileProcessorService = getZipService(data.log);
    const importSourceData = await fileProcessorService.parseFileAsync({
        items: data.items
            ? {
                  file: await fileService.loadFileAsync(data.items.filename),
                  formatService: getItemsFormatService(data.items.formatService)
              }
            : undefined,
        assets: data.assets
            ? {
                  file: await fileService.loadFileAsync(data.assets.filename),
                  formatService: getAssetsFormatService(data.assets.formatService)
              }
            : undefined,
        types: await getFlattenedContentTypesAsync(getImportService(data).getManagementClient(), data.log)
    });

    return importSourceData;
}
