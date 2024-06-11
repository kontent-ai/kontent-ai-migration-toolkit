import { fileManager } from '../file/index.js';
import { Logger, executeWithTrackingAsync, getDefaultLogger } from '../core/index.js';
import { ExportAdapterResult } from '../export/index.js';
import { ZipContext, zipManager } from '../zip/index.js';
import { libMetadata } from '../metadata.js';
import { defaultFilesConfig, getAssetsFormatService, getItemsFormatService } from './utils/toolkit.utils.js';
import { ImportData } from '../import/index.js';
import { FilesConfig } from './models/toolkit.models.js';

export interface StoreConfig {
    readonly data: ExportAdapterResult;
    readonly files?: FilesConfig;
    readonly zipContext?: ZipContext;
    readonly logger?: Logger;
}

export interface ExtractConfig {
    readonly files?: FilesConfig;
    readonly zipContext?: ZipContext;
    readonly logger?: Logger;
}

export async function storeAsync(config: StoreConfig): Promise<void> {
    const logger = config.logger ?? getDefaultLogger();
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
            const itemsZipFile = await zipManager(logger, config.zipContext).createItemsZipAsync(config.data, {
                itemFormatService: getItemsFormatService(files.items.format)
            });

            const assetsZipFile = await zipManager(logger, config.zipContext).createAssetsZipAsync(config.data, {
                assetFormatService: getAssetsFormatService(files.assets.format)
            });

            await fileManager(logger).writeFileAsync(files.items.filename, itemsZipFile);
            await fileManager(logger).writeFileAsync(files.assets.filename, assetsZipFile);
        }
    });
}

export async function extractAsync(config: ExtractConfig): Promise<ImportData> {
    const logger = config.logger ?? getDefaultLogger();
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
                zipContext: config.zipContext,
                logger: logger
            });
        }
    });
}

async function getImportDataFromFilesAsync(data: {
    readonly files: FilesConfig;
    readonly zipContext: ZipContext | undefined;
    readonly logger: Logger;
}): Promise<ImportData> {
    if (data.files.items?.filename?.toLowerCase()?.endsWith('.zip')) {
        return await getImportDataFromZipAsync(data);
    }

    return await getImportDataFromNonZipFileAsync(data);
}

async function getImportDataFromZipAsync(data: {
    readonly zipContext: ZipContext | undefined;
    readonly files: FilesConfig;
    readonly logger: Logger;
}): Promise<ImportData> {
    const importData = await zipManager(data.logger, data.zipContext).parseZipAsync({
        items: data.files.items
            ? {
                  file: await fileManager(data.logger).loadFileAsync(data.files.items.filename),
                  formatService: getItemsFormatService(data.files.items.format)
              }
            : undefined,
        assets: data.files.assets
            ? {
                  file: await fileManager(data.logger).loadFileAsync(data.files.assets.filename),
                  formatService: getAssetsFormatService(data.files.assets.format)
              }
            : undefined
    });

    return importData;
}

async function getImportDataFromNonZipFileAsync(data: {
    readonly files: FilesConfig;
    readonly zipContext: ZipContext | undefined;
    readonly logger: Logger;
}): Promise<ImportData> {
    const importData = await zipManager(data.logger, data.zipContext).parseFileAsync({
        items: data.files.items
            ? {
                  file: await fileManager(data.logger).loadFileAsync(data.files.items.filename),
                  formatService: getItemsFormatService(data.files.items.format)
              }
            : undefined,
        assets: data.files.assets
            ? {
                  file: await fileManager(data.logger).loadFileAsync(data.files.assets.filename),
                  formatService: getAssetsFormatService(data.files.assets.format)
              }
            : undefined
    });

    return importData;
}
