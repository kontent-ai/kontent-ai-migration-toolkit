import { IExportAdapter, IExportAdapterResult } from '../export/index.js';
import { FileProcessorService, IAssetFormatService, IItemFormatService } from '../file-processor/index.js';
import { FileService } from '../node/index.js';

export interface IExporToolkitConfig {
    adapter: IExportAdapter;
}

export class ExportToolkit {
    private readonly fileProcessorService = new FileProcessorService();
    private readonly fileService = new FileService();

    constructor(private readonly config: IExporToolkitConfig) {}

    async exportAsync(config: {
        items: {
            filename: string;
            formatService: IItemFormatService;
        };
        assets?: {
            filename: string;
            formatService: IAssetFormatService;
        };
    }): Promise<IExportAdapterResult> {
        const data = await this.config.adapter.exportAsync();

        const itemsZipFile = await this.fileProcessorService.createItemsZipAsync(data, {
            itemFormatService: config.items.formatService,
            transformConfig: {
                richTextConfig: {
                    replaceInvalidLinks: true
                }
            }
        });

        await this.fileService.writeFileAsync(config.items.filename, itemsZipFile);

        if (data.assets.length && config.assets) {
            const assetsZipFile = await this.fileProcessorService.createAssetsZipAsync(data, {
                assetFormatService: config.assets.formatService
            });

            await this.fileService.writeFileAsync(config.assets.filename, assetsZipFile);
        }

        return data;
    }
}
