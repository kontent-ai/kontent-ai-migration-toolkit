import { HttpService } from '@kontent-ai/core-sdk';
import { AsyncParser } from 'json2csv';
import * as JSZip from 'jszip';

import { IExportAllResult } from '../export';
import { IImportSource } from '../import';
import { IZipServiceConfig } from './zip.models';
import { yellow } from 'colors';
import { Readable } from 'stream';
import { IContentItem, IContentType } from '@kontent-ai/delivery-sdk';

interface ILanguageVariantCsvModel {
    codename: string;
    name: string;
    language: string;
    type: string;
    collection: string;
    last_modified: string;
    workflow_step?: string;

    [elementCodename: string]: any;
}

interface ILanguageVariantsTypeCsvWrapper {
    contentType: IContentType;
    csvFilename: string;
    csv: string;
}

export class ZipService {
    private readonly delayBetweenAssetRequestsMs: number;

    private readonly metadataName: string = 'metadata.json';
    private readonly assetsFolderName: string = 'assets';
    private readonly contentItemsFolderName: string = 'items';

    private readonly httpService: HttpService = new HttpService();

    private readonly csvDelimiter: string = ',';

    constructor(private config: IZipServiceConfig) {
        this.delayBetweenAssetRequestsMs = config?.delayBetweenAssetDownloadRequestsMs ?? 50;
    }

    public async extractZipAsync(zipFile: any): Promise<IImportSource> {
        if (this.config.enableLog) {
            console.log(`Unzipping file`);
        }

        const unzippedFile = await JSZip.loadAsync(zipFile);

        if (this.config.enableLog) {
            console.log(`Parsing zip contents`);
        }
        const result: IImportSource = {
            importData: {
                assets: [],
                languageVariants: [],
                contentItems: []
            },
            binaryFiles: [],
            // binaryFiles: await this.extractBinaryFilesAsync(unzippedFile, assets),
            metadata: await this.readAndParseJsonFile(unzippedFile, this.metadataName)
        };

        if (this.config.enableLog) {
            console.log(`Pasing zip completed`);
        }

        return result;
    }

    public async createZipAsync(exportData: IExportAllResult): Promise<any> {
        const zip = new JSZip();

        if (this.config.enableLog) {
            console.log(`Parsing json`);
        }

        const contentItemsFolder = zip.folder(this.contentItemsFolderName);
        const assetsFolder = zip.folder(this.assetsFolderName);

        if (!assetsFolder) {
            throw Error(`Could not create folder '${yellow(this.assetsFolderName)}'`);
        }

        if (!contentItemsFolder) {
            throw Error(`Could not create folder '${yellow(this.contentItemsFolderName)}'`);
        }

        const typeWrappers = await this.mapLanguageVariantsToCsvAsync(
            exportData.data.contentTypes,
            exportData.data.contentItems
        );

        for (const typeWrapper of typeWrappers) {
            contentItemsFolder.file(typeWrapper.csvFilename, typeWrapper.csv);
        }

        zip.file(this.metadataName, JSON.stringify(exportData.metadata));

        if (this.config.enableLog) {
            console.log(`Adding assets to zip`);
        }

        for (const asset of exportData.data.assets) {
            const assetSubfolderName = asset.assetId.toString().substring(0, 3);

            const assetSubfolderFolder = assetsFolder.folder(assetSubfolderName);

            if (!assetSubfolderFolder) {
                throw Error(`Could not create folder '${yellow(assetSubfolderName)}'`);
            }

            const assetFilename = asset.filename;
            assetSubfolderFolder.file(
                assetFilename,
                await this.getBinaryDataFromUrlAsync(asset.url, this.config.enableLog),
                {
                    binary: true
                }
            );

            // create artificial delay between request to prevent network errors
            await this.sleepAsync(this.delayBetweenAssetRequestsMs);
        }

        if (this.config.enableLog) {
            console.log(`Creating zip file`);
        }

        const content = await zip.generateAsync({ type: this.getZipOutputType() });

        if (this.config.enableLog) {
            console.log(`Zip file prepared`);
        }

        return content;
    }

    private async mapLanguageVariantsToCsvAsync(
        types: IContentType[],
        items: IContentItem[]
    ): Promise<ILanguageVariantsTypeCsvWrapper[]> {
        const typeWrappers: ILanguageVariantsTypeCsvWrapper[] = [];
        for (const contentType of types) {
            const languageVariantFields: string[] = this.getLanguageVariantFields(contentType);
            const contentItemsOfType = items.filter((m) => m.system.type === contentType.system.codename);
            const csvModels: ILanguageVariantCsvModel[] = contentItemsOfType.map((m) =>
                this.mapLanguageVariantToCsvModel(m, contentType)
            );

            const languageVariantsStream = new Readable();
            languageVariantsStream.push(JSON.stringify(csvModels));
            languageVariantsStream.push(null); // required to end the stream

            const parsingProcessor = this.geCsvParser({
                fields: languageVariantFields
            }).fromInput(languageVariantsStream);

            const csvResult = await parsingProcessor.promise();

            typeWrappers.push({
                csv: csvResult ?? '',
                contentType: contentType,
                csvFilename: `${contentType.system.codename}.csv`
            });
        }

        return typeWrappers;
    }

    private getLanguageVariantFields(contentType: IContentType): string[] {
        return [
            'codename',
            'name',
            'language',
            'type',
            'collection',
            'last_modified',
            'workflow_step',
            ...contentType.elements
                .map((m) => m.codename)
                .filter((m) => {
                    if (m?.length) {
                        return true;
                    }
                    return false;
                })
                .map((m) => m as string)
        ];
    }

    private sleepAsync(ms: number): Promise<any> {
        return new Promise((resolve: any) => setTimeout(resolve, ms));
    }

    private geCsvParser(config: { fields: string[] }): AsyncParser<any> {
        return new AsyncParser({ delimiter: this.csvDelimiter, fields: config.fields });
    }

    private mapLanguageVariantToCsvModel(item: IContentItem, contentType: IContentType): ILanguageVariantCsvModel {
        const model: ILanguageVariantCsvModel = {
            codename: item.system.codename,
            name: item.system.name,
            collection: item.system.collection,
            type: item.system.type,
            language: item.system.language,
            last_modified: item.system.lastModified,
            workflow_step: item.system.workflowStep ?? undefined
        };

        for (const element of contentType.elements) {
            if (element.codename) {
                const variantElement = item.elements[element.codename];

                if (variantElement) {
                    model[element.codename] = variantElement.value;
                }
            }
        }

        return model;
    }

    // private async extractBinaryFilesAsync(
    //     zip: JSZip,
    //     assets: AssetContracts.IAssetModelContract[]
    // ): Promise<IBinaryFile[]> {
    //     const binaryFiles: IBinaryFile[] = [];

    //     const files = zip.files;

    //     for (const asset of assets) {
    //         const assetFile = files[this.getFullAssetPath(asset.id, asset.file_name)];

    //         const binaryData = await assetFile.async(this.getZipOutputType());
    //         binaryFiles.push({
    //             asset,
    //             binaryData
    //         });
    //     }

    //     return binaryFiles;
    // }

    private getZipOutputType(): 'nodebuffer' | 'blob' {
        if (this.config.context === 'browser') {
            return 'blob';
        }

        if (this.config.context === 'node.js') {
            return 'nodebuffer';
        }

        throw Error(`Unsupported context '${this.config.context}'`);
    }

    /**
     * Gets path to asset within zip folder. Uses tree format using asset ids such as:
     * "files/3b4/3b42f36c-2e67-4605-a8d3-fee2498e5224/image.jpg"
     */
    // private getFullAssetPath(assetId: string, filename: string): string {
    //     return `${this.assetsFolderName}/${assetId.substring(0, 3)}/${assetId}/${filename}`;
    // }

    private async readAndParseJsonFile(fileContents: any, filename: string): Promise<any> {
        const files = fileContents.files;
        const file = files[filename];

        if (!file) {
            throw Error(`Invalid file '${yellow(filename)}'`);
        }

        const text = await file.async('text');

        return JSON.parse(text);
    }

    private async getBinaryDataFromUrlAsync(url: string, enableLog: boolean): Promise<any> {
        // temp fix for Kontent.ai Repository not validating url
        url = url.replace('#', '%23');

        if (enableLog) {
            console.log(`Downloading ${yellow(url)}`);
        }

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
