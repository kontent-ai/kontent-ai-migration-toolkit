import { ExportService, IExportAllResult, IExportConfig } from '../export/index.js';
import { FileProcessorService, IAssetFormatService, IItemFormatService } from '../file-processor/index.js';
import { FileService } from '../node/index.js';

export interface IExporToolkitConfig extends IExportConfig {}

export class ExportToolkit {
    private readonly fileProcessorService = new FileProcessorService();
    private readonly fileService = new FileService();
    private readonly exportService: ExportService;

    constructor(config: IExporToolkitConfig) {
        this.exportService = new ExportService(config);
    }

    async exportAsync(config: {
        items: {
            filename: string;
            formatService: IItemFormatService;
        };
        assets?: {
            filename: string;
            formatService: IAssetFormatService;
        };
    }): Promise<IExportAllResult> {
        const data = await this.exportService.exportAllAsync();

        const itemsZipFile = await this.fileProcessorService.createItemsZipAsync(data, {
            itemFormatService: config.items.formatService,
            transformConfig: {
                richTextConfig: {
                    replaceInvalidLinks: true
                }
            }
        });

        await this.fileService.writeFileAsync(config.items.filename, itemsZipFile);

        if (data.data.assets.length && config.assets) {
            const assetsZipFile = await this.fileProcessorService.createAssetsZipAsync(data, {
                assetFormatService: config.assets.formatService
            });

            await this.fileService.writeFileAsync(config.assets.filename, assetsZipFile);
        }

        return data;
    }
}
