import { HttpService } from '@kontent-ai/core-sdk';
import * as JSZip from 'jszip';
import { Blob } from 'buffer';

import { IExportAllResult, IExportedAsset } from '../export';
import { IImportAsset, IParsedContentItem, IImportSource, IParsedAsset, IImportContentType } from '../import';
import {
    IFileData,
    IFileProcessorConfig,
    IFormatService,
    IExtractedBinaryFileData,
    ZipCompressionLevel,
    ZipContext
} from './file-processor.models';
import { IContentItem, IContentType } from '@kontent-ai/delivery-sdk';
import { formatBytes, getExtension } from '../core';
import { getType } from 'mime';
import { CsvProcessorService } from './formats/csv-processor.service';
import { JsonProcessorService } from './formats/json-processor.service';
import { logDebug } from '../core/log-helper';

export class FileProcessorService {
    private readonly delayBetweenAssetRequestsMs: number;
    private readonly zipContext: ZipContext = 'node.js';

    private readonly metadataName: string = 'metadata.json';
    private readonly assetsFolderName: string = 'assets';
    private readonly binaryFilesFolderName: string = 'files';
    private readonly contentItemsFolderName: string = 'items';

    private readonly httpService: HttpService = new HttpService();
    private readonly csvProcessorService: CsvProcessorService = new CsvProcessorService();
    private readonly jsonProcessorService: JsonProcessorService = new JsonProcessorService();

    constructor(config?: IFileProcessorConfig) {
        this.delayBetweenAssetRequestsMs = config?.delayBetweenAssetDownloadRequestsMs ?? 50;
    }

    async extractZipAsync(
        file: Buffer,
        types: IImportContentType[],
        config?: { formatService?: IFormatService }
    ): Promise<IImportSource> {
        logDebug('info', 'Loading zip file');

        const zipFile = await JSZip.loadAsync(file, {});

        logDebug('info', 'Parsing zip data');

        const result: IImportSource = {
            importData: {
                items: await this.parseContentItemsFromFileAsync(zipFile, types, config?.formatService),
                assets: await this.parseAssetsFromFileAsync(zipFile, config?.formatService)
            },
            metadata: await this.parseMetadataFromFileAsync(zipFile, this.metadataName)
        };

        logDebug('info', 'Parsing completed');

        return result;
    }

    async extractCsvFileAsync(file: Buffer, types: IImportContentType[]): Promise<IImportSource> {
        logDebug('info', 'Reading CSV file');

        const result: IImportSource = {
            importData: {
                items: await this.csvProcessorService.parseFromExportDataAsync(file.toString(), types),
                assets: []
            },
            metadata: undefined
        };

        logDebug('info', 'Reading CSV file completed');

        return result;
    }

    async extractJsonFileAsync(file: Buffer, types: IImportContentType[]): Promise<IImportSource> {
        logDebug('info', 'Reading JSON file');

        const result: IImportSource = {
            importData: {
                items: await this.jsonProcessorService.parseFromExportDataAsync(file.toString(), types),
                assets: []
            },
            metadata: undefined
        };

        logDebug('info', 'Reading JSON file completed');

        return result;
    }

    async createZipAsync(
        exportData: IExportAllResult,
        config: { formatService: IFormatService; compressionLevel?: ZipCompressionLevel }
    ): Promise<any> {
        const zip = new JSZip();

        const contentItemsFolder = zip.folder(this.contentItemsFolderName);
        const assetsFolder = zip.folder(this.assetsFolderName);
        const filesFolder = zip.folder(this.binaryFilesFolderName);

        if (!filesFolder) {
            throw Error(`Could not create folder '${this.binaryFilesFolderName}'`);
        }

        if (!assetsFolder) {
            throw Error(`Could not create folder '${this.assetsFolderName}'`);
        }

        if (!contentItemsFolder) {
            throw Error(`Could not create folder '${this.contentItemsFolderName}'`);
        }

        logDebug(
            'info',
            `Transforming content '${exportData.data.contentItems.length.toString()}' items`,
            config.formatService?.name
        );

        const transformedLanguageVariantsFileData = await this.transformLanguageVariantsAsync(
            exportData.data.contentTypes,
            exportData.data.contentItems,
            config.formatService
        );

        for (const fileInfo of transformedLanguageVariantsFileData) {
            logDebug('info', `Adding to zip`, fileInfo.filename);
            contentItemsFolder.file(fileInfo.filename, fileInfo.data);
        }

        zip.file(this.metadataName, JSON.stringify(exportData.metadata));

        if (exportData.data.assets.length) {
            const transformedAssetsFileData = await this.transformAssetsAsync(
                exportData.data.assets,
                config.formatService
            );

            for (const fileInfo of transformedAssetsFileData) {
                logDebug('info', `Adding to zip`, fileInfo.filename);
                assetsFolder.file(fileInfo.filename, fileInfo.data);
            }

            logDebug('info', `Preparing to download '${exportData.data.assets.length.toString()}' assets`);

            for (const asset of exportData.data.assets) {
                const assetFilename = `${asset.assetId}.${asset.extension}`; // use id as filename to prevent filename conflicts
                const binaryData = await this.getBinaryDataFromUrlAsync(asset.url);
                filesFolder.file(assetFilename, binaryData, {
                    binary: true
                });

                // create artificial delay between request to prevent network errors
                await this.sleepAsync(this.delayBetweenAssetRequestsMs);
            }

            logDebug('info', `All assets added to zip`);
        } else {
            logDebug('info', `There are no assets to download`);
        }

        const zipOutputType = this.getZipOutputType(this.zipContext);
        const compressionLevel: number = config.compressionLevel ?? 9;

        logDebug(
            'info',
            `Creating zip file using '${zipOutputType}' with compression level '${compressionLevel.toString()}'`
        );

        const zipData = await zip.generateAsync({
            type: zipOutputType,
            compression: 'DEFLATE',
            compressionOptions: {
                level: compressionLevel
            },
            streamFiles: true
        });

        let zipSizeInBytes: number = 0;

        if (zipData instanceof Blob) {
            zipSizeInBytes = zipData.size;
        } else if (zipData instanceof Buffer) {
            zipSizeInBytes = zipData.byteLength;
        }

        logDebug('info', `Zip successfully generated with size '${formatBytes(zipSizeInBytes)}'`);

        return zipData;
    }

    private async transformLanguageVariantsAsync(
        types: IContentType[],
        items: IContentItem[],
        formatService: IFormatService
    ): Promise<IFileData[]> {
        return await formatService.transformToExportDataAsync(types, items);
    }

    private async transformAssetsAsync(assets: IExportedAsset[], formatService: IFormatService): Promise<IFileData[]> {
        return await formatService.transformAssetsAsync(assets);
    }

    private sleepAsync(ms: number): Promise<any> {
        return new Promise((resolve: any) => setTimeout(resolve, ms));
    }

    private async parseAssetsFromFileAsync(zip: JSZip, formatService?: IFormatService): Promise<IImportAsset[]> {
        const importAssets: IImportAsset[] = [];
        const parsedAssets: IParsedAsset[] = [];

        const files = zip.files;

        const binaryFiles: IExtractedBinaryFileData[] = await this.extractBinaryFilesAsync(zip);

        for (const [, file] of Object.entries(files)) {
            if (!file?.name?.startsWith(`${this.assetsFolderName}/`)) {
                // iterate through assets files
                continue;
            }

            if (file?.name?.endsWith('/')) {
                continue;
            }

            const text = await file.async('string');

            if (formatService) {
                // use custom format service
                parsedAssets.push(...(await formatService.parseAssetsAsync(text)));
            } else if (file.name?.toLowerCase()?.endsWith('.csv')) {
                parsedAssets.push(...(await this.csvProcessorService.parseAssetsAsync(text)));
            } else if (file.name?.toLowerCase()?.endsWith('.json')) {
                parsedAssets.push(...(await this.jsonProcessorService.parseAssetsAsync(text)));
            } else {
                throw Error(`Could not extract file '${file.name}'`);
            }
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

        const files = zip.files;
        for (const [, file] of Object.entries(files)) {
            if (!file?.name?.startsWith(`${this.binaryFilesFolderName}/`)) {
                // iterate through assets only
                continue;
            }

            if (file?.name?.endsWith('/')) {
                continue;
            }

            const binaryData = await file.async(this.getZipOutputType(this.zipContext));
            let sizeInBytes: number = 0;

            if (binaryData instanceof Blob) {
                sizeInBytes = binaryData.size;
            } else if (binaryData instanceof Buffer) {
                sizeInBytes = binaryData.byteLength;
            }

            logDebug('extractedBinaryData', `Extracted binary data`, file.name, formatBytes(sizeInBytes));

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

    private async parseContentItemsFromFileAsync(
        fileContents: JSZip,
        types: IImportContentType[],
        formatService?: IFormatService
    ): Promise<IParsedContentItem[]> {
        const files = fileContents.files;
        const parsedItems: IParsedContentItem[] = [];

        for (const [, file] of Object.entries(files)) {
            if (!file?.name?.startsWith(`${this.contentItemsFolderName}/`)) {
                // iterate through content item files only
                continue;
            }

            if (file?.name?.endsWith('/')) {
                continue;
            }

            const text = await file.async('text');

            if (formatService) {
                // use custom format service
                parsedItems.push(...(await formatService.parseFromExportDataAsync(text, types)));
            } else if (file.name?.toLowerCase()?.endsWith('.csv')) {
                parsedItems.push(...(await this.csvProcessorService.parseFromExportDataAsync(text, types)));
            } else if (file.name?.toLowerCase()?.endsWith('.json')) {
                parsedItems.push(...(await this.jsonProcessorService.parseFromExportDataAsync(text, types)));
            } else {
                throw Error(`Could not extract file '${file.name}'`);
            }
        }

        return parsedItems;
    }

    private async parseMetadataFromFileAsync(fileContents: JSZip, filename: string): Promise<any> {
        const files = fileContents.files;
        const file = files[filename];

        if (!file) {
            throw Error(`Invalid file '${filename}'`);
        }

        const text = await file.async('text');

        return JSON.parse(text);
    }

    private async getBinaryDataFromUrlAsync(url: string): Promise<any> {
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

        logDebug('download', url, formatBytes(contentLength));

        return response.data;
    }
}
