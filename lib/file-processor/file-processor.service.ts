import colors from 'colors';
import JSZip from 'jszip';
import { Blob } from 'buffer';

import { IExportAdapterResult, IExportContentItem } from '../export/index.js';
import { IImportAsset, IParsedContentItem, IImportSource, IParsedAsset, IImportContentType } from '../import/index.js';
import {
    IFileData,
    IFileProcessorConfig,
    IItemFormatService,
    IExtractedBinaryFileData,
    ZipCompressionLevel,
    ZipContext,
    IAssetFormatService
} from './file-processor.models.js';
import { IExportTransformConfig, IPackageMetadata, formatBytes, getExtension } from '../core/index.js';
import mime from 'mime';
import { logDebug, logProcessingDebug } from '../core/log-helper.js';

export class FileProcessorService {
    private readonly zipContext: ZipContext = 'node.js';

    private readonly metadataName: string = '_metadata.json';
    private readonly binaryFilesFolderName: string = 'files';

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
        let parsedAssets: IImportAsset[] = [];

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
    ): Promise<any> {
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
            message: `Zip successfully generated`,
            partA: formatBytes(this.getZipSizeInBytes(zipData))
        });

        return zipData;
    }

    async createAssetsZipAsync(
        exportData: IExportAdapterResult,
        config: {
            assetFormatService: IAssetFormatService;
            compressionLevel?: ZipCompressionLevel;
        }
    ): Promise<any> {
        const zip = new JSZip();

        const assetsFolder = zip;
        const filesFolder = zip.folder(this.binaryFilesFolderName);

        if (!filesFolder) {
            throw Error(`Could not create folder '${this.binaryFilesFolderName}'`);
        }

        if (exportData.assets.length) {
            logDebug({
                type: 'info',
                message: `Transforming '${exportData.assets.length.toString()}' asssets`,
                partA: config.assetFormatService?.name
            });

            const transformedAssetsFileData = await config.assetFormatService.transformAssetsAsync(exportData.assets);

            for (const fileInfo of transformedAssetsFileData) {
                logDebug({
                    type: 'info',
                    message: `Adding '${fileInfo.itemsCount}' items to file within zip`,
                    partA: fileInfo.filename
                });
                assetsFolder.file(fileInfo.filename, fileInfo.data);
            }

            let assetIndex: number = 1;
            for (const asset of exportData.assets) {
                const assetFilename = `${asset.assetId}.${asset.extension}`; // use id as filename to prevent filename conflicts

                logProcessingDebug({
                    index: assetIndex,
                    totalCount: exportData.assets.length,
                    itemType: 'zipFile',
                    title: `'${assetFilename}'`
                });

                filesFolder.file(assetFilename, asset.binaryData, {
                    binary: true
                });
                assetIndex++;
            }

            logDebug({
                type: 'info',
                message: `All assets added to zip`
            });
        } else {
            logDebug({
                type: 'info',
                message: `There are no assets`
            });
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
            message: `Zip successfully generated`,
            partA: formatBytes(this.getZipSizeInBytes(zipData))
        });

        return zipData;
    }

    private getZipSizeInBytes(zipData: any): number {
        if (zipData instanceof Blob) {
            return zipData.size;
        } else if (zipData instanceof Buffer) {
            return zipData.byteLength;
        }

        throw Error(`Unrecognized zip data type '${typeof zipData}'`);
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
    ): Promise<IImportAsset[]> {
        const importAssets: IImportAsset[] = [];
        const parsedAssets: IParsedAsset[] = [];

        const files = zip.files;

        const binaryFiles: IExtractedBinaryFileData[] = await this.extractBinaryFilesAsync(zip);

        for (const [, file] of Object.entries(files)) {
            if (file?.name?.endsWith('/')) {
                continue;
            }

            if (file?.name?.toLowerCase() === this.metadataName.toLowerCase()) {
                continue;
            }

            if (file?.name?.startsWith(this.binaryFilesFolderName)) {
                continue;
            }

            const text = await file.async('string');

            parsedAssets.push(...(await assetFormatService.parseAssetsAsync(text)));
        }

        for (const parsedAsset of parsedAssets) {
            const binaryFile = binaryFiles.find((m) => m.assetId === parsedAsset.assetId);

            if (!binaryFile) {
                throw Error(`Could not find binary data for asset with id '${parsedAsset.assetId}'`);
            }

            importAssets.push({
                assetId: parsedAsset.assetId,
                extension: binaryFile.extension,
                filename: parsedAsset.filename,
                mimeType: binaryFile.mimeType,
                binaryData: binaryFile.binaryData
            });
        }

        return importAssets;
    }

    private async extractBinaryFilesAsync(zip: JSZip): Promise<IExtractedBinaryFileData[]> {
        const extractedFiles: IExtractedBinaryFileData[] = [];

        let assetIndex: number = 0;
        const files = Object.entries(zip.files);
        for (const [, file] of files) {
            assetIndex++;

            logProcessingDebug({
                index: assetIndex,
                totalCount: files.length,
                itemType: 'zipFile',
                title: file.name
            });

            if (!file?.name?.startsWith(`${this.binaryFilesFolderName}/`)) {
                // iterate through assets only
                continue;
            }

            if (file?.name?.endsWith('/')) {
                continue;
            }

            const binaryData = await file.async(this.getZipOutputType(this.zipContext));

            logDebug({
                type: 'extractBinaryData',
                message: file.name,
                partA: formatBytes(this.getZipSizeInBytes(binaryData))
            });

            const assetId = this.getAssetIdFromFilename(file.name);
            const extension = getExtension(file.name) ?? '';
            const filename = file.name;
            const mimeType = mime.getType(file.name) ?? '';

            extractedFiles.push({
                assetId: assetId,
                binaryData: binaryData,
                filename: filename,
                mimeType: mimeType,
                extension: extension
            });
        }

        logDebug({
            type: 'info',
            message: `All binary files (${extractedFiles.length}) were extracted`
        });

        return extractedFiles;
    }

    private getAssetIdFromFilename(filename: string): string {
        const split = filename.split('/');
        const filenameWithExtension = split[1];

        return filenameWithExtension.split('.')[0];
    }

    private getZipOutputType(context: ZipContext): 'nodebuffer' | 'blob' {
        if (context === 'browser') {
            return 'blob';
        }

        if (context === 'node.js') {
            return 'nodebuffer';
        }

        throw Error(`Unsupported context '${context}'`);
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
