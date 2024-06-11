import { FileService, getFileService } from '../file/index.js';
import { Logger, executeWithTrackingAsync, getDefaultLogger } from '../core/index.js';
import { ExportAdapterResult } from '../export/index.js';
import { ZipContext, ZipService, getZipService } from '../zip/index.js';
import { libMetadata } from '../metadata.js';
import { defaultFilesConfig, getAssetsFormatService, getItemsFormatService } from './utils/toolkit.utils.js';
import { ImportData } from '../import/index.js';
import { FilesConfig } from './models/toolkit.models.js';

export interface StoreConfig {
    data: ExportAdapterResult;
    files?: FilesConfig;
    zipContext?: ZipContext;
    logger?: Logger;
}

export interface ExtractConfig {
    files?: FilesConfig;
    zipContext?: ZipContext;
    logger?: Logger;
}

export async function storeAsync(config: StoreConfig): Promise<void> {
    const logger = config.logger ?? getDefaultLogger();
    const fileService = getFileService(logger);
    const zipService = getZipService(logger);
    const files = config.files ?? defaultFilesConfig;

    await executeWithTrackingAsync({
        event: {
            tool: 'migrationToolkit',
            package: {
                name: libMetadata.name,
                version: libMetadata.version
            },
            action: 'store',
            relatedEnvironmentId: undefined,
            details: {}
        },
        func: async () => {
            const itemsZipFile = await zipService.createItemsZipAsync(config.data, {
                itemFormatService: getItemsFormatService(files.items.format)
            });

            const assetsZipFile = await zipService.createAssetsZipAsync(config.data, {
                assetFormatService: getAssetsFormatService(files.assets.format)
            });

            await fileService.writeFileAsync(files.items.filename, itemsZipFile);
            await fileService.writeFileAsync(files.assets.filename, assetsZipFile);
        }
    });
}

export async function extractAsync(config: ExtractConfig): Promise<ImportData> {
    const logger = config.logger ?? getDefaultLogger();
    const fileService = getFileService(logger);
    const zipService = getZipService(logger, config.zipContext);
    const files = config.files ?? defaultFilesConfig;

    return await executeWithTrackingAsync({
        event: {
            tool: 'migrationToolkit',
            package: {
                name: libMetadata.name,
                version: libMetadata.version
            },
            action: 'extract',
            relatedEnvironmentId: undefined,
            details: {}
        },
        func: async () => {
            return await getImportDataFromFilesAsync({
                files: files,
                fileService: fileService,
                zipService: zipService,
                logger: logger
            });
        }
    });
}

async function getImportDataFromFilesAsync(data: {
    files: FilesConfig;
    fileService: FileService;
    zipService: ZipService;
    logger: Logger;
}): Promise<ImportData> {
    if (data.files.items?.filename?.toLowerCase()?.endsWith('.zip')) {
        return await getImportDataFromZipAsync(data);
    }

    return await getImportDataFromNonZipFileAsync(data);
}

async function getImportDataFromZipAsync(data: {
    fileService: FileService;
    zipService: ZipService;
    files: FilesConfig;
    logger: Logger;
}): Promise<ImportData> {
    const importData = await data.zipService.parseZipAsync({
        items: data.files.items
            ? {
                  file: await data.fileService.loadFileAsync(data.files.items.filename),
                  formatService: getItemsFormatService(data.files.items.format)
              }
            : undefined,
        assets: data.files.assets
            ? {
                  file: await data.fileService.loadFileAsync(data.files.assets.filename),
                  formatService: getAssetsFormatService(data.files.assets.format)
              }
            : undefined
    });

    return importData;
}

async function getImportDataFromNonZipFileAsync(data: {
    files: FilesConfig;
    zipService: ZipService;
    fileService: FileService;
    logger: Logger;
}): Promise<ImportData> {
    const importData = await data.zipService.parseFileAsync({
        items: data.files.items
            ? {
                  file: await data.fileService.loadFileAsync(data.files.items.filename),
                  formatService: getItemsFormatService(data.files.items.format)
              }
            : undefined,
        assets: data.files.assets
            ? {
                  file: await data.fileService.loadFileAsync(data.files.assets.filename),
                  formatService: getAssetsFormatService(data.files.assets.format)
              }
            : undefined
    });

    return importData;
}
