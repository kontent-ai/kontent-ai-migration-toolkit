import { IContentItem, IContentType } from '@kontent-ai/delivery-sdk';
import { parse } from 'csv-parse';
import { AsyncParser, FieldInfo } from 'json2csv';
import { IImportContentType, IParsedAsset, IParsedContentItem } from '../../import';
import { Readable } from 'stream';
import { IFlattenedContentItem, IFileData } from '../file-processor.models';
import { BaseProcessorService } from './base-processor.service';
import { IExportedAsset } from '../../export';

export class CsvProcessorService extends BaseProcessorService {
    private readonly csvDelimiter: string = ',';
    public readonly name: string = 'csv';

    async transformToExportDataAsync(types: IContentType[], items: IContentItem[]): Promise<IFileData[]> {
        const typeWrappers: IFileData[] = [];
        const flattenedContentItems: IFlattenedContentItem[] = super.flattenContentItems(items, types);
        for (const contentType of types) {
            const contentItemsOfType = flattenedContentItems.filter((m) => m.type === contentType.system.codename);

            const filename: string = `${contentType.system.codename}.csv`;

            const languageVariantFields: FieldInfo<unknown>[] = this.getLanguageVariantFields(contentType);
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

    async parseFromExportDataAsync(text: string, types: IImportContentType[]): Promise<IParsedContentItem[]> {
        const parsedItems: IParsedContentItem[] = [];
        let index = 0;
        const parser = parse(text, {
            cast: true,
            delimiter: this.csvDelimiter
        });

        let parsedColumns: string[] = [];
        const systemFields = super.getSystemContentItemFields();

        for await (const record of parser) {
            if (index === 0) {
                // process header row
                parsedColumns = record;
            } else {
                // process data row
                const contentItem: IParsedContentItem = {
                    type: '',
                    codename: '',
                    collection: '',
                    elements: [],
                    language: '',
                    last_modified: '',
                    name: '',
                    workflow_step: ''
                };

                let fieldIndex: number = 0;
                const contentItemTypeCodename: string = record[0]; // type is set in first index
                for (const columnName of parsedColumns) {
                    const columnValue = record[fieldIndex];

                    if (systemFields.find((m) => m.toLowerCase() === columnName.toLowerCase())) {
                        // column is system field
                        contentItem[columnName] = columnValue;
                    } else {
                        // column is element field
                        const element = super.getElement(types, contentItemTypeCodename, columnName);

                        contentItem.elements.push({
                            codename: element.codename,
                            value: columnValue,
                            type: element.type
                        });
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
        const asssetFiels: FieldInfo<unknown>[] = this.getAssetFields();
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

    private geCsvParser(config: { fields: string[] | FieldInfo<unknown>[] }): AsyncParser<unknown> {
        return new AsyncParser({
            delimiter: this.csvDelimiter,
            fields: config.fields
        });
    }

    private getCsvElementName(elementCodename: string): string {
        return `${elementCodename}`;
    }

    private getLanguageVariantFields(contentType: IContentType): FieldInfo<unknown>[] {
        return [
            ...this.getSystemContentItemFields().map((m) => {
                const field: FieldInfo<unknown> = {
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
                    const field: FieldInfo<unknown> = {
                        label: this.getCsvElementName(m.codename ?? ''),
                        value: m.codename ?? ''
                    };

                    return field;
                })
        ];
    }

    private getAssetFields(): FieldInfo<unknown>[] {
        return [
            ...this.getSystemAssetFields().map((m) => {
                const field: FieldInfo<unknown> = {
                    label: m,
                    value: m
                };

                return field;
            })
        ];
    }
}
