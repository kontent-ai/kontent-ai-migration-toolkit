import { ElementType, IContentItem, IContentType } from '@kontent-ai/delivery-sdk';
import { parse } from 'csv-parse';
import { AsyncParser, FieldInfo } from 'json2csv';
import { IParsedAsset, IParsedContentItem } from '../../import';
import { Readable } from 'stream';
import { ILanguageVariantDataModel, IFileData } from '../file-processor.models';
import { BaseProcessorService } from './base-processor.service';
import { IExportedAsset } from '../../export';

export class CsvProcessorService extends BaseProcessorService {
    private readonly csvDelimiter: string = ',';
    public readonly name: string = 'csv';

    async transformLanguageVariantsAsync(types: IContentType[], items: IContentItem[]): Promise<IFileData[]> {
        const typeWrappers: IFileData[] = [];
        const flattenedContentItems: ILanguageVariantDataModel[] = super.flattenLanguageVariants(items, types);
        for (const contentType of types) {
            const contentItemsOfType = flattenedContentItems.filter((m) => m.type === contentType.system.codename);

            const filename: string = `${contentType.system.codename}.csv`;

            const languageVariantFields: FieldInfo<any>[] = this.getLanguageVariantFields(contentType);
            const languageVariantsStream = new Readable();
            languageVariantsStream.push(JSON.stringify(contentItemsOfType));
            languageVariantsStream.push(null); // required to end the stream

            const parsingProcessor = this.geCsvParser({
                fields: languageVariantFields
            }).fromInput(languageVariantsStream);

            const data = (await parsingProcessor.promise()) ?? '';

            typeWrappers.push({
                data: data,
                filename: filename
            });
        }

        return typeWrappers;
    }

    async parseContentItemsAsync(text: string): Promise<IParsedContentItem[]> {
        const parsedItems: IParsedContentItem[] = [];
        let index = 0;
        const parser = parse(text, {
            cast: true,
            delimiter: this.csvDelimiter
        });

        let parsedColumns: string[] = [];

        for await (const record of parser) {
            if (index === 0) {
                // process header row
                parsedColumns = record;
            } else {
                // process data row
                const contentItem: IParsedContentItem = {
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
                for (const columnName of parsedColumns) {
                    const columnValue = record[fieldIndex];

                    if (columnName.includes(')') && columnName.includes(')')) {
                        // process user defined element
                        const parsedElementName = this.parseCsvElementName(columnName);

                        contentItem.elements.push({
                            type: parsedElementName.elementType,
                            codename: parsedElementName.elementCodename,
                            value: columnValue
                        });
                    } else {
                        // process base element
                        contentItem[columnName] = columnValue;
                    }

                    fieldIndex++;
                }

                parsedItems.push(contentItem);
            }
            index++;
        }

        return parsedItems;
    }

    async transformAssetsAsync(assets: IExportedAsset[]): Promise<IFileData[]> {
        const asssetFiels: FieldInfo<any>[] = this.getAssetFields();
        const stream = new Readable();
        stream.push(JSON.stringify(assets));
        stream.push(null); // required to end the stream

        const parsingProcessor = this.geCsvParser({
            fields: asssetFiels
        }).fromInput(stream);

        const data = (await parsingProcessor.promise()) ?? '';

        return [
            {
                filename: 'assets.csv',
                data: data
            }
        ];
    }

    async parseAssetsAsync(text: string): Promise<IParsedAsset[]> {
        const parsedAssets: IParsedAsset[] = [];
        let index = 0;
        const parser = parse(text, {
            cast: true,
            delimiter: this.csvDelimiter
        });

        let parsedColumns: string[] = [];

        for await (const record of parser) {
            if (index === 0) {
                // process header row
                parsedColumns = record;
            } else {
                // process data row
                const parsedAsset: IParsedAsset = {
                    assetId: '',
                    extension: '',
                    filename: '',
                    url: ''
                };

                let fieldIndex: number = 0;
                for (const columnName of parsedColumns) {
                    const columnValue = record[fieldIndex];
                    (parsedAsset as any)[columnName] = columnValue;
                    fieldIndex++;
                }

                parsedAssets.push(parsedAsset);
            }
            index++;
        }

        return parsedAssets;
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

    private geCsvParser(config: { fields: string[] | FieldInfo<any>[] }): AsyncParser<any> {
        return new AsyncParser({
            delimiter: this.csvDelimiter,
            fields: config.fields
        });
    }

    private getCsvElementName(elementCodename: string, elementType: ElementType): string {
        return `${elementCodename} (${elementType})`;
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

    private getAssetFields(): FieldInfo<any>[] {
        return [
            ...this.getBaseAssetFields().map((m) => {
                const field: FieldInfo<any> = {
                    label: m,
                    value: m
                };

                return field;
            })
        ];
    }
}
