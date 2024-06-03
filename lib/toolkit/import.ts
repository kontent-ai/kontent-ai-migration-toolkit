import { AssetsFormatConfig, ItemsFormatConfig, getZipService } from '../zip/index.js';
import { IMigrationAsset, IMigrationItem, Log, getDefaultLogAsync, getFlattenedContentTypesAsync } from '../core/index.js';
import { IImportAdapter, IImportData } from '../import/index.js';
import { getAssetsFormatService, getItemsFormatService } from './utils/toolkit.utils.js';
import { getFileService } from '../file/index.js';

export interface IImportConfig {
    adapter: IImportAdapter;
    items: IMigrationItem[];
    assets: IMigrationAsset[];
}

export interface IImportFromFilesConfig {
    adapter: IImportAdapter;
    items: {
        filename: string;
        formatService: ItemsFormatConfig;
    };
    assets: {
        filename: string;
        formatService: AssetsFormatConfig;
    };
    log?: Log;
}

export async function importAsync(config: IImportConfig): Promise<void> {
    await config.adapter.importAsync(config);
}

export async function importFromFilesAsync(config: IImportFromFilesConfig): Promise<void> {
    await config.adapter.importAsync(await getSourceDataAsync(config));
}

async function getSourceDataAsync(config: IImportFromFilesConfig): Promise<IImportData> {
    const log = config.log ?? await getDefaultLogAsync();

    if (config?.items?.filename?.toLowerCase()?.endsWith('.zip')) {
        return await getImportDataFromZipAsync(config, log);
    }

    return await getImportDataFromNonZipFileAsync(config, log);
}

async function getImportDataFromZipAsync(config: IImportFromFilesConfig, log: Log): Promise<IImportData> {
    const fileService = getFileService(log);
    const fileProcessorService = getZipService(log);

    const importSourceData = await fileProcessorService.parseZipAsync({
        items: config.items
            ? {
                  file: await fileService.loadFileAsync(config.items.filename),
                  formatService: getItemsFormatService(config.items.formatService)
              }
            : undefined,
        assets: config.assets
            ? {
                  file: await fileService.loadFileAsync(config.assets.filename),
                  formatService: getAssetsFormatService(config.assets.formatService)
              }
            : undefined,
        types: await getFlattenedContentTypesAsync(config.adapter.client, log)
    });

    return importSourceData;
}

async function getImportDataFromNonZipFileAsync(config: IImportFromFilesConfig, log: Log): Promise<IImportData> {
    const fileService = getFileService(log);
    const fileProcessorService = getZipService(log);
    const importSourceData = await fileProcessorService.parseFileAsync({
        items: config.items
            ? {
                  file: await fileService.loadFileAsync(config.items.filename),
                  formatService: getItemsFormatService(config.items.formatService)
              }
            : undefined,
        assets: config.assets
            ? {
                  file: await fileService.loadFileAsync(config.assets.filename),
                  formatService: getAssetsFormatService(config.assets.formatService)
              }
            : undefined,
        types: await getFlattenedContentTypesAsync(config.adapter.client, log)
    });

    return importSourceData;
}
