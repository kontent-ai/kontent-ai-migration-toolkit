import { executeWithTrackingAsync, packageVersion } from '../core/index.js';
import { IExportAdapter, IExportAdapterResult } from '../export/index.js';
import { FileProcessorService, IAssetFormatService, IItemFormatService } from '../file-processor/index.js';
import { FileService } from '../node/index.js';

export interface IExporToolkitConfig {
    adapter: IExportAdapter;
    items: {
        filename: string;
        formatService: IItemFormatService;
    };
    assets?: {
        filename: string;
        formatService: IAssetFormatService;
    };
}

export class ExportToolkit {
    private readonly fileProcessorService = new FileProcessorService();
    private readonly fileService = new FileService();

    constructor(private readonly config: IExporToolkitConfig) {}

    async exportAsync(): Promise<IExportAdapterResult> {
        return await executeWithTrackingAsync({
            event: {
                tool: 'migration-toolkit',
                version: packageVersion,
                action: 'export',
                relatedEnvironmentId: undefined,
                details: {
                    adapter: this.config.adapter.name
                }
            },
            func: async () => {
                const data = await this.config.adapter.exportAsync();

                const itemsZipFile = await this.fileProcessorService.createItemsZipAsync(data, {
                    itemFormatService: this.config.items.formatService,
                    transformConfig: {
                        richTextConfig: {
                            replaceInvalidLinks: true
                        }
                    }
                });

                await this.fileService.writeFileAsync(this.config.items.filename, itemsZipFile);

                if (data.assets.length && this.config.assets) {
                    const assetsZipFile = await this.fileProcessorService.createAssetsZipAsync(data, {
                        assetFormatService: this.config.assets.formatService
                    });

                    await this.fileService.writeFileAsync(this.config.assets.filename, assetsZipFile);
                }

                return data;
            }
        });
    }
}
