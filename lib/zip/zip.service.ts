import {
    AssetContracts,
    ContentItemContracts,
    ContentTypeContracts,
    LanguageContracts,
    LanguageVariantContracts
} from '@kontent-ai/management-sdk';
import { HttpService } from '@kontent-ai/core-sdk';
import { AsyncParser } from 'json2csv';
import * as JSZip from 'jszip';

import { IExportAllResult } from '../export';
import { IBinaryFile, IImportSource } from '../import';
import { IZipServiceConfig } from './zip.models';
import { yellow } from 'colors';
import { Readable } from 'stream';

interface IContentItemCsvModel {
    id: string;
    name: string;
    codename: String;
    type?: string;
    external_id?: string;
    last_modified: string;
    collection?: string;
}

interface ILanguageVariantCsvModel extends IContentItemCsvModel {
    [elementCodename: string]: any;
}

interface ILanguageCsvWrapper {
    language: LanguageContracts.ILanguageModelContract;
    languageFolderName: string;
    typeWrappers: ILanguageVariantsTypeCsvWrapper[];
}

interface ILanguageVariantsTypeCsvWrapper {
    contentType: ContentTypeContracts.IContentTypeContract;
    csvFilename: string;
    csv: string;
}

interface IJoinedLanguageVariants {
    contentItem: ContentItemContracts.IContentItemModelContract;
    languageVariants: LanguageVariantContracts.ILanguageVariantModelContract[];
}

export class ZipService {
    private readonly delayBetweenAssetRequestsMs: number;

    private readonly contentItemsName: string = 'contentItems.csv';
    private readonly assetsName: string = 'assets.json';
    private readonly languageVariantsName: string = 'languageVariants.json';
    private readonly metadataName: string = 'metadata.json';
    private readonly filesName: string = 'files';
    private readonly contentItemsFolderName: string = 'contentItems';
    private readonly languageVariantsFolderName: string = 'languageVariants';

    private readonly validationName: string = 'validation.json';
    private readonly httpService: HttpService = new HttpService();

    private readonly csvDelimiter: string = ',';

    constructor(private config: IZipServiceConfig) {
        this.delayBetweenAssetRequestsMs = config?.delayBetweenAssetDownloadRequestsMs ?? 150;
    }

    public async extractZipAsync(zipFile: any): Promise<IImportSource> {
        if (this.config.enableLog) {
            console.log(`Unzipping file`);
        }

        const unzippedFile = await JSZip.loadAsync(zipFile);

        if (this.config.enableLog) {
            console.log(`Parsing zip contents`);
        }
        const assets = await this.readAndParseJsonFile(unzippedFile, this.assetsName);
        const result: IImportSource = {
            importData: {
                assets,
                languageVariants: await this.readAndParseJsonFile(unzippedFile, this.languageVariantsName),
                contentItems: await this.readAndParseJsonFile(unzippedFile, this.contentItemsName)
            },
            binaryFiles: await this.extractBinaryFilesAsync(unzippedFile, assets),
            validation: await this.readAndParseJsonFile(unzippedFile, this.validationName),
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
        const languageVariantsFolder = zip.folder(this.languageVariantsFolderName);
        const assetsFolder = zip.folder(this.filesName);

        if (!assetsFolder) {
            throw Error(`Could not create folder '${yellow(this.filesName)}'`);
        }

        if (!contentItemsFolder) {
            throw Error(`Could not create folder '${yellow(this.contentItemsFolderName)}'`);
        }

        if (!languageVariantsFolder) {
            throw Error(`Could not create folder '${yellow(this.languageVariantsFolderName)}'`);
        }

        contentItemsFolder.file(
            this.contentItemsName,
            (await this.mapContentItemsToCsvAsync(exportData.data.contentItems)) ?? ''
        );
        contentItemsFolder.file(this.assetsName, JSON.stringify(exportData.data.assets));

        const languageCsvWrappers = await this.mapLanguageVariantsToCsvAsync(
            exportData.data.contentTypes,
            exportData.data.contentItems,
            exportData.data.languageVariants,
            exportData.data.languages
        );

        for (const languageCsvWrapper of languageCsvWrappers) {
            const languageCsvFolder = languageVariantsFolder.folder(languageCsvWrapper.languageFolderName);

            if (!languageCsvFolder) {
                throw Error(`Could not create folder '${yellow(languageCsvWrapper.languageFolderName)}'`);
            }

            for (const typeWrapper of languageCsvWrapper.typeWrappers) {
                languageCsvFolder.file(typeWrapper.csvFilename, typeWrapper.csv);
            }
        }

        zip.file(this.metadataName, JSON.stringify(exportData.metadata));
        zip.file(this.validationName, JSON.stringify(exportData.validation));

        if (this.config.enableLog) {
            console.log(`Adding assets to zip`);
        }

        for (const asset of exportData.data.assets) {
            const assetIdShortFolderName = asset.id.substr(0, 3);
            const assetIdShortFolder = assetsFolder.folder(assetIdShortFolderName);

            if (!assetIdShortFolder) {
                throw Error(`Could not create folder '${yellow(this.filesName)}'`);
            }

            const assetIdFolderName = asset.id;
            const assetIdFolder = assetIdShortFolder.folder(assetIdFolderName);

            if (!assetIdFolder) {
                throw Error(`Could not create folder '${yellow(this.filesName)}'`);
            }

            const assetFilename = asset.file_name;
            assetIdFolder.file(assetFilename, await this.getBinaryDataFromUrlAsync(asset.url, this.config.enableLog), {
                binary: true
            });

            // create artificial delay between requests as to prevent errors on network
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

    private async mapContentItemsToCsvAsync(
        items: ContentItemContracts.IContentItemModelContract[]
    ): Promise<string | undefined> {
        const csvModels: IContentItemCsvModel[] = items.map((m) => this.mapContentItemToCsvModel(m));

        const itemsStream = new Readable();
        itemsStream.push(JSON.stringify(csvModels));
        itemsStream.push(null); // required to end the stream

        const parsingProcessor = this.geCsvParser({
            fields: this.getContentItemFields()
        }).fromInput(itemsStream);

        const csvResult = await parsingProcessor.promise();

        return csvResult ?? undefined;
    }

    private async mapLanguageVariantsToCsvAsync(
        contentTypes: ContentTypeContracts.IContentTypeContract[],
        contentItems: ContentItemContracts.IContentItemModelContract[],
        languageVariants: LanguageVariantContracts.ILanguageVariantModelContract[],
        languages: LanguageContracts.ILanguageModelContract[]
    ): Promise<ILanguageCsvWrapper[]> {
        const result: ILanguageCsvWrapper[] = [];
        const joinedLanguageVariants: IJoinedLanguageVariants[] = this.getJoinedLanguageVariants(
            contentItems,
            languageVariants
        );

        for (const language of languages) {
            const typeWrappers: ILanguageVariantsTypeCsvWrapper[] = [];
            for (const contentType of contentTypes) {
                const languageVariantFields: string[] = this.getLanguageVariantFields(contentType);
                const contentItemWithVariants = joinedLanguageVariants.filter(
                    (m) => m.contentItem.type.id === contentType.id
                );
                const csvModels: ILanguageVariantCsvModel[] = [];

                for (const contentItemWithVariant of contentItemWithVariants) {
                    csvModels.push(
                        ...contentItemWithVariant.languageVariants
                            .filter((m) => m.language.id === language.id)
                            .map((m) =>
                                this.mapLanguageVariantToCsvModel(contentItemWithVariant.contentItem, m, contentType)
                            )
                    );
                }

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
                    csvFilename: `${contentType.codename}.csv`
                });
            }

            result.push({
                language: language,
                languageFolderName: `${language.codename}`,
                typeWrappers: typeWrappers
            });
        }

        return result;
    }

    private getJoinedLanguageVariants(
        contentItems: ContentItemContracts.IContentItemModelContract[],
        languageVariants: LanguageVariantContracts.ILanguageVariantModelContract[]
    ): IJoinedLanguageVariants[] {
        const joinedLanguageVariants: IJoinedLanguageVariants[] = [];

        for (const contentItem of contentItems) {
            joinedLanguageVariants.push({
                contentItem: contentItem,
                languageVariants: languageVariants.filter((m) => m.item.id === contentItem.id)
            });
        }

        return joinedLanguageVariants;
    }

    private getContentItemFields(): string[] {
        return ['id', 'name', 'codename', 'type', 'external_id', 'last_modified', 'collection'];
    }

    private getLanguageVariantFields(contentType: ContentTypeContracts.IContentTypeContract): string[] {
        return [
            ...this.getContentItemFields(),
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

    private mapContentItemToCsvModel(item: ContentItemContracts.IContentItemModelContract): IContentItemCsvModel {
        return {
            codename: item.codename,
            collection: item.collection?.id,
            external_id: item.external_id,
            id: item.id,
            last_modified: item.last_modified.toString(),
            name: item.name,
            type: item.type.id
        };
    }

    private mapLanguageVariantToCsvModel(
        item: ContentItemContracts.IContentItemModelContract,
        languageVariant: LanguageVariantContracts.ILanguageVariantModelContract,
        contentType: ContentTypeContracts.IContentTypeContract
    ): ILanguageVariantCsvModel {
        const model: ILanguageVariantCsvModel = {
            ...this.mapContentItemToCsvModel(item)
        };

        for (const element of contentType.elements) {
            if (element.codename) {
                const variantElement = languageVariant.elements.find((m) => m.element.id === element.id);

                if (variantElement) {
                    model[element.codename] = variantElement.value;
                }
            }
        }

        return model;
    }

    private async extractBinaryFilesAsync(
        zip: JSZip,
        assets: AssetContracts.IAssetModelContract[]
    ): Promise<IBinaryFile[]> {
        const binaryFiles: IBinaryFile[] = [];

        const files = zip.files;

        for (const asset of assets) {
            const assetFile = files[this.getFullAssetPath(asset.id, asset.file_name)];

            const binaryData = await assetFile.async(this.getZipOutputType());
            binaryFiles.push({
                asset,
                binaryData
            });
        }

        return binaryFiles;
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

    /**
     * Gets path to asset within zip folder. Uses tree format using asset ids such as:
     * "files/3b4/3b42f36c-2e67-4605-a8d3-fee2498e5224/image.jpg"
     */
    private getFullAssetPath(assetId: string, filename: string): string {
        return `${this.filesName}/${assetId.substr(0, 3)}/${assetId}/${filename}`;
    }

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
            console.log(`Asset download: ${yellow(url)}`);
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
