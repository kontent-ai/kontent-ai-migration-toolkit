import { HttpService } from '@kontent-ai/core-sdk';
import * as JSZip from 'jszip';
import { Blob } from 'buffer';

import { IExportAllResult } from '../export';
import { IImportAsset, IParsedContentItem, IImportSource, IParsedAsset, IImportContentType } from '../import';
import {
    IFileData,
    IFileProcessorConfig,
    IItemFormatService,
    IExtractedBinaryFileData,
    ZipCompressionLevel,
    ZipContext,
    IAssetFormatService
} from './file-processor.models';
import { IContentItem, IContentType } from '@kontent-ai/delivery-sdk';
import { IPackageMetadata, formatBytes, getExtension, sleepAsync } from '../core';
import { getType } from 'mime';
import { ItemCsvProcessorService } from './item-formats/item-csv-processor.service';
import { ItemJsonProcessorService } from './item-formats/item-json-processor.service';
import { logDebug } from '../core/log-helper';

export class FileProcessorService {
    private readonly delayBetweenAssetRequestsMs: number;
    private readonly zipContext: ZipContext = 'node.js';

    private readonly metadataName: string = '_metadata.json';
    private readonly binaryFilesFolderName: string = 'files';

    private readonly httpService: HttpService = new HttpService();
    private readonly itemCsvProcessorService: ItemCsvProcessorService = new ItemCsvProcessorService();
    private readonly itemJsonProcessorService: ItemJsonProcessorService = new ItemJsonProcessorService();

    constructor(config?: IFileProcessorConfig) {
        this.delayBetweenAssetRequestsMs = config?.delayBetweenAssetDownloadRequestsMs ?? 10;
    }

    async extractZipAsync(
        itemsFile: Buffer,
        assetsFile: Buffer | undefined,
        types: IImportContentType[],
        config: { itemFormatService: IItemFormatService; assetFormatService: IAssetFormatService }
    ): Promise<IImportSource> {
        logDebug({
            type: 'info',
            message: 'Loading items zip file'
        });
        const itemsZipFile = await JSZip.loadAsync(itemsFile, {});
        logDebug({
            type: 'info',
            message: 'Parsing items zip data'
        });

        let assetsZipFile: JSZip | undefined = undefined;
        if (assetsFile) {
            logDebug({
                type: 'info',
                message: 'Loading assets zip file'
            });
            assetsZipFile = await JSZip.loadAsync(assetsFile, {});

            logDebug({
                type: 'info',
                message: 'Parsing assets zip data'
            });
        }

        const result: IImportSource = {
            importData: {
                items: await this.parseContentItemsFromZipAsync(itemsZipFile, types, config.itemFormatService),
                assets: assetsZipFile
                    ? await this.parseAssetsFromFileAsync(assetsZipFile, config.assetFormatService)
                    : []
            },
            metadata: await this.parseMetadataFromZipAsync(itemsZipFile, this.metadataName)
        };

        logDebug({
            type: 'info',
            message: 'Parsing completed'
        });

        return result;
    }

    async extractCsvFileAsync(file: Buffer, types: IImportContentType[]): Promise<IImportSource> {
        logDebug({
            type: 'info',
            message: 'Reading CSV file'
        });

        const result: IImportSource = {
            importData: {
                items: await this.itemCsvProcessorService.parseContentItemsAsync(file.toString(), types),
                assets: []
            },
            metadata: undefined
        };

        logDebug({
            type: 'info',
            message: 'Reading CSV file completed'
        });

        return result;
    }

    async extractJsonFileAsync(file: Buffer, types: IImportContentType[]): Promise<IImportSource> {
        logDebug({
            type: 'info',
            message: 'Reading JSON file'
        });

        const result: IImportSource = {
            importData: {
                items: await this.itemJsonProcessorService.parseContentItemsAsync(file.toString(), types),
                assets: []
            },
            metadata: undefined
        };

        logDebug({
            type: 'info',
            message: 'Reading JSON file completed'
        });

        return result;
    }

    async createItemsZipAsync(
        exportData: IExportAllResult,
        config: {
            itemFormatService: IItemFormatService;
            compressionLevel?: ZipCompressionLevel;
        }
    ): Promise<any> {
        const zip = new JSZip();
        const contentItemsFolder = zip;

        logDebug({
            type: 'info',
            message: `Adding metadata to zip`,
            partA: this.metadataName
        });
        zip.file(this.metadataName, JSON.stringify(exportData.metadata));

        logDebug({
            type: 'info',
            message: `Transforming '${exportData.data.contentItems.length.toString()}' content items`,
            partA: config.itemFormatService?.name
        });

        const transformedLanguageVariantsFileData = await this.transformLanguageVariantsAsync(
            exportData.data.contentTypes,
            exportData.data.contentItems,
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
        exportData: IExportAllResult,
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

        logDebug({
            type: 'info',
            message: `Storing metadata`,
            partA: this.metadataName
        });
        zip.file(this.metadataName, JSON.stringify(exportData.metadata));

        if (exportData.data.assets.length) {
            logDebug({
                type: 'info',
                message: `Transforming '${exportData.data.assets.length.toString()}' asssets`,
                partA: config.assetFormatService?.name
            });

            const transformedAssetsFileData = await config.assetFormatService.transformAssetsAsync(
                exportData.data.assets
            );

            for (const fileInfo of transformedAssetsFileData) {
                logDebug({
                    type: 'info',
                    message: `Adding '${fileInfo.itemsCount}' items to file within zip`,
                    partA: fileInfo.filename
                });
                assetsFolder.file(fileInfo.filename, fileInfo.data);
            }

            logDebug({
                type: 'info',
                message: `Preparing to download '${exportData.data.assets.length.toString()}' assets`
            });

            let assetIndex: number = 1;
            for (const asset of exportData.data.assets) {
                const assetFilename = `${asset.assetId}.${asset.extension}`; // use id as filename to prevent filename conflicts
                const binaryDataResponse = await this.getBinaryDataFromUrlAsync(asset.url);

                logDebug({
                    type: 'download',
                    message: asset.url,
                    partB: formatBytes(binaryDataResponse.contentLength),
                    processingIndex: {
                        index: assetIndex,
                        totalCount: exportData.data.assets.length
                    }
                });

                filesFolder.file(assetFilename, binaryDataResponse.data, {
                    binary: true
                });

                // create artificial delay between request to prevent network errors
                await sleepAsync(this.delayBetweenAssetRequestsMs);

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
        types: IContentType[],
        items: IContentItem[],
        formatService: IItemFormatService
    ): Promise<IFileData[]> {
        return await formatService.transformContentItemsAsync(types, items);
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
            logDebug({
                type: 'info',
                message: `Processing zip file`,
                partA: file.name,
                processingIndex: {
                    index: assetIndex,
                    totalCount: files.length
                }
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
            const mimeType = getType(file.name) ?? '';

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

    private async getBinaryDataFromUrlAsync(url: string): Promise<{ data: any; contentLength: number }> {
        // temp fix for Kontent.ai Repository not validating url
        url = url.replace('#', '%23');

        const response = await this.httpService.getAsync(
            {
                url
            },
            {
                responseType: 'arraybuffer'
            }
        );

        const contentLengthHeader = response.headers.find((m) => m.header.toLowerCase() === 'content-length');
        const contentLength = contentLengthHeader ? +contentLengthHeader.value : 0;

        return { data: response.data, contentLength: contentLength };
    }
}
