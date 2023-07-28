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
import { formatBytes, getExtension, sleepAsync } from '../core';
import { getType } from 'mime';
import { ItemCsvProcessorService } from './item-formats/item-csv-processor.service';
import { ItemJsonProcessorService } from './item-formats/item-json-processor.service';
import { logDebug } from '../core/log-helper';

export class FileProcessorService {
    private readonly delayBetweenAssetRequestsMs: number;
    private readonly zipContext: ZipContext = 'node.js';

    private readonly metadataName: string = 'metadata.json';
    private readonly assetsFolderName: string = 'assets';
    private readonly binaryFilesFolderName: string = 'files';
    private readonly contentItemsFolderName: string = 'items';

    private readonly httpService: HttpService = new HttpService();
    private readonly itemCsvProcessorService: ItemCsvProcessorService = new ItemCsvProcessorService();
    private readonly itemJsonProcessorService: ItemJsonProcessorService = new ItemJsonProcessorService();

    constructor(config?: IFileProcessorConfig) {
        this.delayBetweenAssetRequestsMs = config?.delayBetweenAssetDownloadRequestsMs ?? 50;
    }

    async extractZipAsync(
        itemsFile: Buffer,
        assetsFile: Buffer | undefined,
        types: IImportContentType[],
        config: { itemFormatService: IItemFormatService; assetFormatService: IAssetFormatService }
    ): Promise<IImportSource> {
        logDebug('info', 'Loading items zip file');
        const itemsZipFile = await JSZip.loadAsync(itemsFile, {});
        logDebug('info', 'Parsing items zip data');

        let assetsZipFile: JSZip | undefined = undefined;
        if (assetsFile) {
            logDebug('info', 'Loading assets zip file');
            assetsZipFile = await JSZip.loadAsync(assetsFile, {});
            logDebug('info', 'Parsing assets zip data');
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

        logDebug('info', 'Parsing completed');

        return result;
    }

    async extractCsvFileAsync(file: Buffer, types: IImportContentType[]): Promise<IImportSource> {
        logDebug('info', 'Reading CSV file');

        const result: IImportSource = {
            importData: {
                items: await this.itemCsvProcessorService.parseContentItemsAsync(file.toString(), types),
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
                items: await this.itemJsonProcessorService.parseContentItemsAsync(file.toString(), types),
                assets: []
            },
            metadata: undefined
        };

        logDebug('info', 'Reading JSON file completed');

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

        const contentItemsFolder = zip.folder(this.contentItemsFolderName);

        if (!contentItemsFolder) {
            throw Error(`Could not create folder '${this.contentItemsFolderName}'`);
        }

        logDebug('info', `Storing metadata`, this.metadataName);
        zip.file(this.metadataName, JSON.stringify(exportData.metadata));

        logDebug(
            'info',
            `Transforming '${exportData.data.contentItems.length.toString()}' content items`,
            config.itemFormatService?.name
        );

        const transformedLanguageVariantsFileData = await this.transformLanguageVariantsAsync(
            exportData.data.contentTypes,
            exportData.data.contentItems,
            config.itemFormatService
        );

        for (const fileInfo of transformedLanguageVariantsFileData) {
            logDebug('zip', `Adding to zip`, fileInfo.filename);
            contentItemsFolder.file(fileInfo.filename, fileInfo.data);
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

        logDebug('info', `Zip successfully generated`, formatBytes(this.getZipSizeInBytes(zipData)));
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

        const assetsFolder = zip.folder(this.assetsFolderName);
        const filesFolder = zip.folder(this.binaryFilesFolderName);

        if (!filesFolder) {
            throw Error(`Could not create folder '${this.binaryFilesFolderName}'`);
        }

        if (!assetsFolder) {
            throw Error(`Could not create folder '${this.assetsFolderName}'`);
        }

        logDebug('info', `Storing metadata`, this.metadataName);
        zip.file(this.metadataName, JSON.stringify(exportData.metadata));

        if (exportData.data.assets.length) {
            logDebug(
                'info',
                `Transforming '${exportData.data.assets.length.toString()}' asssets`,
                config.assetFormatService?.name
            );
            const transformedAssetsFileData = await config.assetFormatService.transformAssetsAsync(
                exportData.data.assets
            );

            for (const fileInfo of transformedAssetsFileData) {
                logDebug('zip', `Adding to zip`, fileInfo.filename);
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
                await sleepAsync(this.delayBetweenAssetRequestsMs);
            }

            logDebug('info', `All assets added to zip`);
        } else {
            logDebug('info', `There are no assets`);
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

        logDebug('info', `Zip successfully generated`, formatBytes(this.getZipSizeInBytes(zipData)));

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
            if (!file?.name?.startsWith(`${this.assetsFolderName}/`)) {
                // iterate through assets files
                continue;
            }

            if (file?.name?.endsWith('/')) {
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

            logDebug(
                'extractedBinaryData',
                `Extracted binary data`,
                file.name,
                formatBytes(this.getZipSizeInBytes(binaryData))
            );

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

    private isContentItemsFolders(file: JSZip.JSZipObject): boolean {
        if (file?.name?.startsWith(`${this.contentItemsFolderName}/`)) {
            return true;
        }

        return false;
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
            if (!this.isContentItemsFolders(file)) {
                // iterate through content item files only
                continue;
            }

            if (file?.name?.endsWith('/')) {
                continue;
            }

            const text = await file.async('text');

            parsedItems.push(...(await formatService.parseContentItemsAsync(text, types)));
        }

        return parsedItems;
    }

    private async parseMetadataFromZipAsync(fileContents: JSZip, filename: string): Promise<any> {
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
