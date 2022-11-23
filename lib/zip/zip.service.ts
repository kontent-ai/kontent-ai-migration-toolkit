import { HttpService } from '@kontent-ai/core-sdk';
import { AsyncParser, FieldInfo } from 'json2csv';
import * as JSZip from 'jszip';

import { IExportAllResult } from '../export';
import { IImportAsset, IImportContentItem, IImportSource } from '../import';
import { ILanguageVariantCsvModel, ILanguageVariantsTypeCsvWrapper, IZipServiceConfig } from './zip.models';
import { yellow } from 'colors';
import { Readable } from 'stream';
import { ElementType, IContentItem, IContentType } from '@kontent-ai/delivery-sdk';
import { getExtension, translationHelper } from '../core';
import { parse } from 'csv-parse';
import { getType } from 'mime';

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
        console.log(`Unzipping file`);

        const unzippedFile = await JSZip.loadAsync(zipFile);

        console.log(`Parsing zip contents`);
        const result: IImportSource = {
            importData: {
                items: await this.parseContentItemsCsvFileAsync(unzippedFile),
                assets: await this.extractAssetsAsync(unzippedFile)
            },
            metadata: await this.readAndParseJsonFileAsync(unzippedFile, this.metadataName)
        };

        console.log(`Pasing zip completed`);

        return result;
    }

    public async createZipAsync(exportData: IExportAllResult): Promise<any> {
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

        console.log(
            `Mapping '${yellow(exportData.data.contentItems.length.toString())}' content items to '${yellow('csv')}'`
        );

        const typeWrappers = await this.mapLanguageVariantsToCsvAsync(
            exportData.data.contentTypes,
            exportData.data.contentItems
        );

        for (const typeWrapper of typeWrappers) {
            contentItemsFolder.file(typeWrapper.csvFilename, typeWrapper.csv);
        }

        zip.file(this.metadataName, JSON.stringify(exportData.metadata));

        console.log(`Preparing to download '${yellow(exportData.data.assets.length.toString())}' assets`);

        for (const asset of exportData.data.assets) {
            const assetFilename = asset.filename;
            assetsFolder.file(assetFilename, await this.getBinaryDataFromUrlAsync(asset.url), {
                binary: true
            });

            // create artificial delay between request to prevent network errors
            await this.sleepAsync(this.delayBetweenAssetRequestsMs);
        }

        console.log(`All assets added to zip \n`);

        const zipOutputType = this.getZipOutputType();
        console.log(`Creating zip file using '${yellow(zipOutputType)}'`);

        const content = await zip.generateAsync({ type: zipOutputType });

        console.log(`Zip file generated`);

        return content;
    }

    private async mapLanguageVariantsToCsvAsync(
        types: IContentType[],
        items: IContentItem[]
    ): Promise<ILanguageVariantsTypeCsvWrapper[]> {
        const typeWrappers: ILanguageVariantsTypeCsvWrapper[] = [];
        for (const contentType of types) {
            const languageVariantFields: FieldInfo<any>[] = this.getLanguageVariantFields(contentType);
            const contentItemsOfType = items.filter((m) => m.system.type === contentType.system.codename);
            const csvModels: ILanguageVariantCsvModel[] = contentItemsOfType.map((m) =>
                this.mapLanguageVariantToCsvModel(m, contentType, types, items)
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

    private getBaseContentItemFields(): string[] {
        return ['codename', 'name', 'language', 'type', 'collection', 'last_modified', 'workflow_step'];
    }

    private getLanguageVariantFields(contentType: IContentType): FieldInfo<any>[] {
        return [
            ...this.getBaseContentItemFields().map((m) => {
                const field: FieldInfo<any> = {
                    label: m,
                    value: m
                };

                return field;
            }),
            ...contentType.elements
                .filter((m) => {
                    if (m.codename?.length) {
                        return true;
                    }
                    return false;
                })
                .map((m) => {
                    const field: FieldInfo<any> = {
                        label: this.getCsvElementName(m.codename ?? '', m.type as ElementType),
                        value: m.codename ?? ''
                    };

                    return field;
                })
        ];
    }

    private sleepAsync(ms: number): Promise<any> {
        return new Promise((resolve: any) => setTimeout(resolve, ms));
    }

    private geCsvParser(config: { fields: string[] | FieldInfo<any>[] }): AsyncParser<any> {
        return new AsyncParser({
            delimiter: this.csvDelimiter,
            fields: config.fields
        });
    }

    private mapLanguageVariantToCsvModel(
        item: IContentItem,
        contentType: IContentType,
        types: IContentType[],
        items: IContentItem[]
    ): ILanguageVariantCsvModel {
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
                    model[element.codename] = translationHelper.transformToExportValue(variantElement, items, types);
                }
            }
        }

        return model;
    }

    private async extractAssetsAsync(zip: JSZip): Promise<IImportAsset[]> {
        const assets: IImportAsset[] = [];

        const files = zip.files;

        for (const [, file] of Object.entries(files)) {
            if (!file?.name?.startsWith(`${this.assetsFolderName}/`)) {
                // iterate through assets only
                continue;
            }

            if (file?.name?.endsWith('/')) {
                continue;
            }

            const binaryData = await file.async(this.getZipOutputType());

            const filename = file.name;
            const extension = getExtension(filename);
            assets.push({
                assetId: this.getAssetIdFromFilename(filename),
                binaryData: binaryData,
                filename: filename.split('/')[1],
                mimeType: getType(filename) ?? undefined,
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

    private async parseContentItemsCsvFileAsync(fileContents: any): Promise<IImportContentItem[]> {
        const files = fileContents.files;
        const parsedItems: IImportContentItem[] = [];

        for (const [, file] of Object.entries(files)) {
            if (!(file as any)?.name?.startsWith(`${this.contentItemsFolderName}/`)) {
                // iterate through content item files only
                continue;
            }
            let index = 0;

            const text = await (file as any).async('text');

            const parser = parse(text, {
                cast: true,
                delimiter: this.csvDelimiter
            });

            let parsedElements: string[] = [];

            for await (const record of parser) {
                if (index === 0) {
                    // process header row
                    parsedElements = record;
                } else {
                    // process data row
                    const contentItem: IImportContentItem = {
                        codename: '',
                        collection: '',
                        elements: [],
                        language: '',
                        last_modified: '',
                        name: '',
                        type: '',
                        workflow_step: ''
                    };

                    let fieldIndex: number = 0;
                    for (const elementName of parsedElements) {
                        const elementValue = record[fieldIndex];

                        if (elementName.includes(')') && elementName.includes(')')) {
                            // process user defined element
                            const parsedElementName = this.parseCsvElementName(elementName);

                            contentItem.elements.push({
                                type: parsedElementName.elementType,
                                codename: parsedElementName.elementCodename,
                                value: elementValue
                            });
                        } else {
                            // process base element
                            contentItem[elementName] = elementValue;
                        }

                        fieldIndex++;
                    }

                    parsedItems.push(contentItem);
                }
                index++;
            }
        }

        return parsedItems;
    }

    private getCsvElementName(elementCodename: string, elementType: ElementType): string {
        return `${elementCodename} (${elementType})`;
    }

    private parseCsvElementName(elementName: string): { elementCodename: string; elementType: ElementType } {
        const matchedResult = elementName.match(/\(([^)]+)\)/);

        if (matchedResult && matchedResult.length > 1) {
            return {
                elementType: matchedResult[1].trim() as ElementType,
                elementCodename: elementName.replace(/ *\([^)]*\) */g, '').trim()
            };
        }

        throw Error(`Could not parse CSV element name '${elementName}' to determine element type & codename`);
    }

    private async readAndParseJsonFileAsync(fileContents: any, filename: string): Promise<any> {
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

        console.log(`Downloading ${yellow(url)}`);

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
