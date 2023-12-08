import colors from 'colors';
import JSZip from 'jszip';

import { IExportAdapterResult, IExportContentItem } from '../export/index.js';
import { IParsedContentItem, IImportSource, IImportContentType, IParsedAsset } from '../import/index.js';
import {
    IFileData,
    IFileProcessorConfig,
    IItemFormatService,
    ZipCompressionLevel,
    ZipContext,
    IAssetFormatService,
    BinaryData
} from './file-processor.models.js';
import { IExportTransformConfig, IPackageMetadata, logDebug, logErrorAndExit } from '../core/index.js';
import { ZipService } from './zip-service.js';

export class FileProcessorService {
    private readonly zipContext: ZipContext = 'node.js';

    private readonly metadataName: string = '_metadata.json';

    constructor(config?: IFileProcessorConfig) {}

    async parseZipAsync(data: {
        items?: {
            file: Buffer;
            formatService: IItemFormatService;
        };
        assets?: {
            file: Buffer;
            formatService: IAssetFormatService;
        };
        types: IImportContentType[];
    }): Promise<IImportSource> {
        let itemsZipFile: JSZip | undefined = undefined;
        let assetsZipFile: JSZip | undefined = undefined;

        if (data.items) {
            logDebug({
                type: 'info',
                message: 'Loading items zip file'
            });
            itemsZipFile = await JSZip.loadAsync(data.items.file, {});
            logDebug({
                type: 'info',
                message: 'Parsing items zip data'
            });
        }

        if (data.assets) {
            logDebug({
                type: 'info',
                message: 'Loading assets zip file'
            });
            assetsZipFile = await JSZip.loadAsync(data.assets.file, {});
            logDebug({
                type: 'info',
                message: 'Parsing assets zip data'
            });
        }

        const result: IImportSource = {
            importData: {
                items:
                    itemsZipFile && data.items
                        ? await this.parseContentItemsFromZipAsync(itemsZipFile, data.types, data.items.formatService)
                        : [],
                assets:
                    assetsZipFile && data.assets
                        ? await this.parseAssetsFromFileAsync(assetsZipFile, data.assets?.formatService)
                        : []
            },
            metadata: itemsZipFile ? await this.parseMetadataFromZipAsync(itemsZipFile, this.metadataName) : undefined
        };

        logDebug({
            type: 'info',
            message: 'Parsing completed'
        });

        return result;
    }

    async parseFileAsync(data: {
        items?: {
            file: Buffer;
            formatService: IItemFormatService;
        };
        assets?: {
            file: Buffer;
            formatService: IAssetFormatService;
        };
        types: IImportContentType[];
    }): Promise<IImportSource> {
        let parsedItems: IParsedContentItem[] = [];
        let parsedAssets: IParsedAsset[] = [];

        if (data.items) {
            logDebug({
                type: 'info',
                message: `Parsing items file with '${colors.yellow(data.items.formatService.name)}' `
            });

            parsedItems = await data.items.formatService.parseContentItemsAsync(data.items.file.toString(), data.types);
        }

        if (data.assets) {
            logDebug({
                type: 'info',
                message: `Parsing assets file with '${colors.yellow(data.assets.formatService.name)}' `
            });

            const assetsZipFile = await JSZip.loadAsync(data.assets.file, {});
            parsedAssets = await this.parseAssetsFromFileAsync(assetsZipFile, data.assets.formatService);
        }

        const result: IImportSource = {
            importData: {
                items: parsedItems,
                assets: parsedAssets
            },
            metadata: undefined
        };

        logDebug({
            type: 'info',
            message: `Parsing completed. Parsed '${colors.yellow(
                result.importData.items.length.toString()
            )}' items and '${colors.yellow(result.importData.assets.length.toString())}' assets`
        });

        return result;
    }

    async createItemsZipAsync(
        exportData: IExportAdapterResult,
        config: {
            transformConfig: IExportTransformConfig;
            itemFormatService: IItemFormatService;
            compressionLevel?: ZipCompressionLevel;
        }
    ): Promise<BinaryData> {
        const zip = new JSZip();
        const contentItemsFolder = zip;

        logDebug({
            type: 'info',
            message: `Transforming '${exportData.items.length.toString()}' content items`,
            partA: config.itemFormatService?.name
        });

        const transformedLanguageVariantsFileData = await this.transformLanguageVariantsAsync(
            exportData.items,
            config.itemFormatService
        );

        for (const fileInfo of transformedLanguageVariantsFileData) {
            logDebug({
                type: 'info',
                message: `Adding '${fileInfo.itemsCount}' items to file within zip`,
                partA: fileInfo.filename
            });

            contentItemsFolder.file(fileInfo.filename, fileInfo.data);
        }

        const zipOutputType = this.getZipOutputType(this.zipContext);
        const compressionLevel: number = config.compressionLevel ?? 9;

        logDebug({
            type: 'info',
            message: `Creating zip file using '${zipOutputType}' with compression level '${compressionLevel.toString()}'`
        });

        const zipData = await zip.generateAsync({
            type: zipOutputType,
            compression: 'DEFLATE',
            compressionOptions: {
                level: compressionLevel
            },
            streamFiles: true
        });

        logDebug({
            type: 'info',
            message: `Zip successfully generated`
        });

        return zipData;
    }

    async createAssetsZipAsync(
        exportData: IExportAdapterResult,
        config: {
            assetFormatService: IAssetFormatService;
            compressionLevel?: ZipCompressionLevel;
        }
    ): Promise<BinaryData> {
        logDebug({
            type: 'info',
            message: `Creating assets zip`,
            partA: config.assetFormatService?.name
        });

        const zip = await config.assetFormatService.transformAssetsAsync({
            assets: exportData.assets,
            zip: new ZipService(new JSZip())
        });

        return zip;
    }

    private async transformLanguageVariantsAsync(
        items: IExportContentItem[],
        formatService: IItemFormatService
    ): Promise<IFileData[]> {
        return await formatService.transformContentItemsAsync(items);
    }

    private async parseAssetsFromFileAsync(
        zip: JSZip,
        assetFormatService: IAssetFormatService
    ): Promise<IParsedAsset[]> {
        return assetFormatService.parseAssetsAsync({
            zip: new ZipService(zip)
        });
    }

    private getZipOutputType(context: ZipContext): 'nodebuffer' | 'blob' {
        if (context === 'browser') {
            return 'blob';
        }

        if (context === 'node.js') {
            return 'nodebuffer';
        }

        logErrorAndExit({
            message: `Unsupported context '${context}'`
        });
    }

    private async parseContentItemsFromZipAsync(
        fileContents: JSZip,
        types: IImportContentType[],
        formatService: IItemFormatService
    ): Promise<IParsedContentItem[]> {
        const files = fileContents.files;
        const parsedItems: IParsedContentItem[] = [];

        for (const file of Object.values(files)) {
            if (file?.name?.endsWith('/')) {
                continue;
            }

            if (file?.name?.toLowerCase() === this.metadataName.toLowerCase()) {
                continue;
            }

            const text = await file.async('text');

            parsedItems.push(...(await formatService.parseContentItemsAsync(text, types)));
        }

        return parsedItems;
    }

    private async parseMetadataFromZipAsync(
        fileContents: JSZip,
        filename: string
    ): Promise<undefined | IPackageMetadata> {
        const files = fileContents.files;
        const file = files[filename];

        if (!file) {
            // metadata is not required
            return undefined;
        }

        const text = await file.async('text');

        return JSON.parse(text);
    }
}
