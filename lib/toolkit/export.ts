import { libMetadata } from '../metadata.js';
import { Log, executeWithTrackingAsync } from '../core/index.js';
import { IExportAdapter, IExportAdapterResult } from '../export/index.js';
import { getAssetsFormatService, getItemsFormatService } from './utils/toolkit.utils.js';
import { AssetsFormatConfig, ItemsFormatConfig, getZipService } from '../zip/index.js';
import { getFileService } from '../file/index.js';

export interface IExportConfig {
    log: Log;
    adapter: IExportAdapter;
    items: {
        filename: string;
        formatService: ItemsFormatConfig;
    };
    assets: {
        filename: string;
        formatService: AssetsFormatConfig;
    };
}

export async function exportAsync(config: IExportConfig): Promise<IExportAdapterResult> {
    const fileService = getFileService(config.log);
    const fileProcessorService = getZipService(config.log);

    return await executeWithTrackingAsync({
        event: {
            tool: 'migrationToolkit',
            package: {
                name: libMetadata.name,
                version: libMetadata.version
            },
            action: 'export',
            relatedEnvironmentId: undefined,
            details: {
                adapter: config.adapter.name
            }
        },
        func: async () => {
            const data = await config.adapter.exportAsync();

            const itemsZipFile = await fileProcessorService.createItemsZipAsync(data, {
                itemFormatService: getItemsFormatService(config.items.formatService)
            });

            await fileService.writeFileAsync(config.items.filename, itemsZipFile);

            if (config.assets) {
                const assetsZipFile = await fileProcessorService.createAssetsZipAsync(data, {
                    assetFormatService: getAssetsFormatService(config.assets.formatService)
                });

                await fileService.writeFileAsync(config.assets.filename, assetsZipFile);
            }

            return data;
        }
    });
}
