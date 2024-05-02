import { libMetadata } from '../metadata.js';
import {
    AssetsFormatConfig,
    ItemsFormatConfig,
    Log,
    executeWithTrackingAsync,
    getAssetsFormatService,
    getItemsFormatService
} from '../core/index.js';
import { IExportAdapter, IExportAdapterResult } from '../export/index.js';
import { FileProcessorService, getFileProcessorService } from '../file-processor/index.js';
import { FileService, getFileService } from '../node/index.js';

export interface IExporToolkitConfig {
    log: Log;
    adapter: IExportAdapter;
    items: {
        filename: string;
        formatService: ItemsFormatConfig;
    };
    assets?: {
        filename: string;
        formatService: AssetsFormatConfig;
    };
}

export class ExportToolkit {
    private readonly fileProcessorService: FileProcessorService;
    private readonly fileService: FileService;

    constructor(private readonly config: IExporToolkitConfig) {
        this.fileService = getFileService(config.log);
        this.fileProcessorService = getFileProcessorService(config.log);
    }

    async exportAsync(): Promise<IExportAdapterResult> {
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
                    adapter: this.config.adapter.name
                }
            },
            func: async () => {
                const data = await this.config.adapter.exportAsync();

                const itemsZipFile = await this.fileProcessorService.createItemsZipAsync(data, {
                    itemFormatService: getItemsFormatService(this.config.items.formatService),
                    transformConfig: {
                        richTextConfig: {
                            replaceInvalidLinks: true
                        }
                    }
                });

                await this.fileService.writeFileAsync(this.config.items.filename, itemsZipFile);

                if (this.config.assets) {
                    const assetsZipFile = await this.fileProcessorService.createAssetsZipAsync(data, {
                        assetFormatService: getAssetsFormatService(this.config.assets.formatService)
                    });

                    await this.fileService.writeFileAsync(this.config.assets.filename, assetsZipFile);
                }

                return data;
            }
        });
    }
}
