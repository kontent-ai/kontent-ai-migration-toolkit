import { HttpService } from '@kontent-ai/core-sdk';
import * as JSZip from 'jszip';

import { IExportAllResult, IExportedAsset } from '../export';
import { IImportAsset, IImportContentItem, IImportSource } from '../import';
import {
    ILanguageVariantDataModel,
    ILanguageVariantsTypeDataWrapper,
    IFileProcessorConfig,
    IAssetDetailModel,
    IFormatService
} from './file-processor.models';
import { yellow } from 'colors';
import { IContentItem, IContentType } from '@kontent-ai/delivery-sdk';
import { getExtension, translationHelper } from '../core';
import { getType } from 'mime';
import { CsvProcessorService } from './formats/csv-processor.service';
import { JsonProcessorService } from './formats/json-processor.service';

export class FileProcessorService {
    private readonly delayBetweenAssetRequestsMs: number;

    private readonly metadataName: string = 'metadata.json';
    private readonly assetDetailsName: string = '_details.json';
    private readonly assetsFolderName: string = 'assets';
    private readonly contentItemsFolderName: string = 'items';

    private readonly httpService: HttpService = new HttpService();
    private readonly csvProcessorService: CsvProcessorService = new CsvProcessorService();
    private readonly jsonProcessorService: JsonProcessorService = new JsonProcessorService();

    constructor(private config: IFileProcessorConfig) {
        this.delayBetweenAssetRequestsMs = config?.delayBetweenAssetDownloadRequestsMs ?? 50;
    }

    async extractZipAsync(file: Buffer): Promise<IImportSource> {
        console.log(`Unzipping file`);

        const zipFile = await JSZip.loadAsync(file);

        console.log(`Parsing zip contents`);
        const result: IImportSource = {
            importData: {
                items: await this.parseContentItemsFromFileAsync(zipFile),
                assets: await this.parseAssetsFromFileAsync(zipFile)
            },
            metadata: await this.parseMetadataFromFileAsync(zipFile, this.metadataName)
        };

        console.log(`Pasing zip completed`);

        return result;
    }

    async extractCsvFileAsync(file: Buffer): Promise<IImportSource> {
        console.log(`Reading CSV file`);

        const result: IImportSource = {
            importData: {
                items: await this.csvProcessorService.parseImportItemsAsync(file.toString()),
                assets: []
            },
            metadata: undefined
        };

        console.log(`Reading CSV file completed`);

        return result;
    }

    async extractJsonFileAsync(file: Buffer): Promise<IImportSource> {
        console.log(`Reading JSON file`);

        const result: IImportSource = {
            importData: {
                items: await this.jsonProcessorService.parseImportItemsAsync(file.toString()),
                assets: []
            },
            metadata: undefined
        };

        console.log(`Reading JSON file completed`);

        return result;
    }

    async createZipAsync(exportData: IExportAllResult, formatService: IFormatService): Promise<any> {
        const zip = new JSZip();

        console.log('');

        const contentItemsFolder = zip.folder(this.contentItemsFolderName);
        const assetsFolder = zip.folder(this.assetsFolderName);

        if (!assetsFolder) {
            throw Error(`Could not create folder '${yellow(this.assetsFolderName)}'`);
        }

        if (!contentItemsFolder) {
            throw Error(`Could not create folder '${yellow(this.contentItemsFolderName)}'`);
        }

        console.log(`Transforming '${yellow(exportData.data.contentItems.length.toString())}' content items`);

        const typeWrappers = await this.getTypeWrappersAsync(
            exportData.data.contentTypes,
            this.mapLanguageVariantsToDataModels(exportData.data.contentItems, exportData.data.contentTypes),
            formatService
        );

        for (const typeWrapper of typeWrappers) {
            console.log(`Adding '${yellow(typeWrapper.filename)}' to zip`);
            contentItemsFolder.file(typeWrapper.filename, typeWrapper.data);
        }

        zip.file(this.metadataName, JSON.stringify(exportData.metadata));

        console.log('');

        if (exportData.data.assets.length) {
            assetsFolder.file(this.assetDetailsName, JSON.stringify(this.getAssetDetailModels(exportData.data.assets)));

            console.log(`Preparing to download '${yellow(exportData.data.assets.length.toString())}' assets`);

            for (const asset of exportData.data.assets) {
                const assetFilename = `${asset.assetId}.${asset.extension}`; // use id as filename to prevent filename conflicts
                assetsFolder.file(assetFilename, await this.getBinaryDataFromUrlAsync(asset.url), {
                    binary: true
                });

                // create artificial delay between request to prevent network errors
                await this.sleepAsync(this.delayBetweenAssetRequestsMs);
            }

            console.log(`All assets added to zip \n`);
        } else {
            console.log(`There are no assets to download\n`);
        }

        const zipOutputType = this.getZipOutputType();
        console.log(`Creating zip file using '${yellow(zipOutputType)}'`);

        const content = await zip.generateAsync({ type: zipOutputType });

        console.log(`Zip file generated`);

        return content;
    }

    private async getTypeWrappersAsync(
        types: IContentType[],
        items: ILanguageVariantDataModel[],
        formatService: IFormatService
    ): Promise<ILanguageVariantsTypeDataWrapper[]> {
        return await formatService.mapLanguageVariantsAsync(types, items);
    }

    private getAssetDetailModels(extractedAssets: IExportedAsset[]): IAssetDetailModel[] {
        return extractedAssets.map((m) => {
            const item: IAssetDetailModel = {
                assetId: m.assetId,
                filename: m.filename
            };

            return item;
        });
    }

    private sleepAsync(ms: number): Promise<any> {
        return new Promise((resolve: any) => setTimeout(resolve, ms));
    }

    private mapLanguageVariantsToDataModels(items: IContentItem[], types: IContentType[]): ILanguageVariantDataModel[] {
        const mappedItems: ILanguageVariantDataModel[] = [];

        for (const item of items) {
            const type = types.find((m) => m.system.codename.toLowerCase() === item.system.type.toLowerCase());

            if (!type) {
                throw Error(`Could not find type '${item.system.type}'`);
            }
            const model: ILanguageVariantDataModel = {
                codename: item.system.codename,
                name: item.system.name,
                collection: item.system.collection,
                type: item.system.type,
                language: item.system.language,
                last_modified: item.system.lastModified,
                workflow_step: item.system.workflowStep ?? undefined
            };

            for (const element of type.elements) {
                if (element.codename) {
                    const variantElement = item.elements[element.codename];

                    if (variantElement) {
                        model[element.codename] = translationHelper.transformToExportValue(
                            variantElement,
                            items,
                            types
                        );
                    }
                }
            }

            mappedItems.push(model);
        }

        return mappedItems;
    }

    private async parseAssetsFromFileAsync(zip: JSZip): Promise<IImportAsset[]> {
        const assets: IImportAsset[] = [];

        const files = zip.files;

        const assetDetailsFilePath = `${this.assetsFolderName}/${this.assetDetailsName}`;
        const assetDetailsFile = files[assetDetailsFilePath];

        if (!assetDetailsFile) {
            throw Error(`Invalid file path '${assetDetailsFilePath}'`);
        }

        const assetDetailModels = JSON.parse(await assetDetailsFile.async('string')) as IAssetDetailModel[];

        for (const [, file] of Object.entries(files)) {
            if (!file?.name?.startsWith(`${this.assetsFolderName}/`)) {
                // iterate through assets only
                continue;
            }

            if (file?.name?.endsWith('/')) {
                continue;
            }

            if (file?.name === this.assetDetailsName) {
                continue;
            }

            const binaryData = await file.async(this.getZipOutputType());

            const assetId = this.getAssetIdFromFilename(file.name);
            const assetDetailModel = assetDetailModels.find((m) => m.assetId === assetId);
            const extension = getExtension(file.name);
            const filename = assetDetailModel?.filename ?? `${assetId}.${extension}`;
            const mimeType = getType(file.name) ?? undefined;

            assets.push({
                assetId: assetId,
                binaryData: binaryData,
                filename: filename,
                mimeType: mimeType,
                extension: extension
            });
        }

        return assets;
    }

    private getAssetIdFromFilename(filename: string): string {
        const split = filename.split('/');
        const filenameWithExtension = split[1];

        return filenameWithExtension.split('.')[0];
    }

    private getZipOutputType(): 'nodebuffer' | 'blob' {
        if (this.config.context === 'browser') {
            return 'blob';
        }

        if (this.config.context === 'node.js') {
            return 'nodebuffer';
        }

        throw Error(`Unsupported context '${this.config.context}'`);
    }

    private async parseContentItemsFromFileAsync(fileContents: JSZip): Promise<IImportContentItem[]> {
        const files = fileContents.files;
        const parsedItems: IImportContentItem[] = [];

        for (const [, file] of Object.entries(files)) {
            if (!file?.name?.startsWith(`${this.contentItemsFolderName}/`)) {
                // iterate through content item files only
                continue;
            }

            if (file?.name?.endsWith('/')) {
                continue;
            }

            const text = await file.async('text');

            if (file.name?.toLowerCase()?.endsWith('.csv')) {
                parsedItems.push(...(await this.csvProcessorService.parseImportItemsAsync(text)));
            } else if (file.name?.toLowerCase()?.endsWith('.json')) {
                parsedItems.push(...(await this.jsonProcessorService.parseImportItemsAsync(text)));
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
            throw Error(`Invalid file '${yellow(filename)}'`);
        }

        const text = await file.async('text');

        return JSON.parse(text);
    }

    private async getBinaryDataFromUrlAsync(url: string): Promise<any> {
        // temp fix for Kontent.ai Repository not validating url
        url = url.replace('#', '%23');

        console.log(`Downloading '${yellow(url)}'`);

        return (
            await this.httpService.getAsync(
                {
                    url
                },
                {
                    responseType: 'arraybuffer'
                }
            )
        ).data;
    }
}
