import { IContentItem, IContentType } from '@kontent-ai/delivery-sdk';
import { parse } from 'csv-parse';
import { AsyncParser, FieldInfo } from 'json2csv';
import { IImportContentType, IParsedAsset, IParsedContentItem } from '../../import';
import { Readable } from 'stream';
import { IFileData } from '../file-processor.models';
import { BaseProcessorService } from './base-processor.service';
import { IExportedAsset } from '../../export';
import { translationHelper } from '../../core';

interface ICsvItem {
    type: string;
    codename: string;
    name: string;
    language: string;
    collection: string;
    last_modified: string;
    workflow_step?: string;
    [propertyName: string]: string | undefined | string[];
}

export class CsvProcessorService extends BaseProcessorService {
    private readonly csvDelimiter: string = ',';
    public readonly name: string = 'csv';

    async transformContentItemsAsync(types: IContentType[], items: IContentItem[]): Promise<IFileData[]> {
        const fileData: IFileData[] = [];
        const csvItems: ICsvItem[] = items.map((item) => this.mapToCsvItem(item, types, items));

        for (const contentType of types) {
            const contentItemsOfType = csvItems.filter((m) => m.type === contentType.system.codename);
            const filename: string = `${contentType.system.codename}.csv`;

            const fieldsToStore: FieldInfo<string>[] = this.getFieldsToExport(contentType);
            const languageVariantsStream = new Readable();
            languageVariantsStream.push(JSON.stringify(contentItemsOfType));
            languageVariantsStream.push(null); // required to end the stream

            const parsingProcessor = this.geCsvParser({
                fields: fieldsToStore
            }).fromInput(languageVariantsStream);

            const data = (await parsingProcessor.promise()) ?? '';

            fileData.push({
                data: data,
                filename: filename
            });
        }

        return fileData;
    }

    async parseContentItemsAsync(text: string, types: IImportContentType[]): Promise<IParsedContentItem[]> {
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
                    system: {
                        type: '',
                        codename: '',
                        collection: '',
                        language: '',
                        last_modified: '',
                        name: '',
                        workflow_step: ''
                    },
                    elements: []
                };

                let fieldIndex: number = 0;
                const contentItemTypeCodename: string = record[0]; // type is set in first index
                for (const columnName of parsedColumns) {
                    const columnValue = record[fieldIndex];

                    if (systemFields.find((m) => m.toLowerCase() === columnName.toLowerCase())) {
                        // column is system field
                        (contentItem.system as any)[columnName] = columnValue;
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
        const asssetFiels: FieldInfo<string>[] = this.getAssetFields();
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

    private mapToCsvItem(item: IContentItem, types: IContentType[], items: IContentItem[]): ICsvItem {
        const csvItem: ICsvItem = {
            type: item.system.type,
            codename: item.system.codename,
            collection: item.system.collection,
            language: item.system.language,
            last_modified: item.system.lastModified,
            name: item.system.name,
            workflow_step: item.system.workflowStep ?? undefined
        };

        const type = types.find((m) => m.system.codename === item.system.type);

        if (!type) {
            throw Error(`Missing content type '${item.system.type}' for item '${item.system.codename}'`);
        }

        for (const element of type.elements) {
            if (element.codename) {
                const variantElement = item.elements[element.codename];

                if (variantElement) {
                    csvItem[element.codename] = translationHelper.transformToExportElementValue(
                        variantElement,
                        items,
                        types
                    );
                }
            }
        }

        return csvItem;
    }

    private geCsvParser(config: { fields: string[] | FieldInfo<string>[] }): AsyncParser<string> {
        return new AsyncParser({
            delimiter: this.csvDelimiter,
            fields: config.fields
        });
    }

    private getFieldsToExport(contentType: IContentType): FieldInfo<string>[] {
        return [
            ...this.getSystemContentItemFields().map((m) => {
                const field: FieldInfo<string> = {
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
                    const field: FieldInfo<string> = {
                        label: m.codename ?? '',
                        value: m.codename ?? ''
                    };

                    return field;
                })
        ];
    }

    private getAssetFields(): FieldInfo<string>[] {
        return [
            ...this.getSystemAssetFields().map((m) => {
                const field: FieldInfo<string> = {
                    label: m,
                    value: m
                };

                return field;
            })
        ];
    }
}
