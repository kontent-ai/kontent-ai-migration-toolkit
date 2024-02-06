import { parse } from 'csv-parse';
import { AsyncParser, FieldInfo } from 'json2csv';
import { Readable } from 'stream';
import { FileBinaryData, ItemsParseData, ItemsTransformData } from '../file-processor.models.js';
import { BaseItemProcessorService } from '../base-item-processor.service.js';
import { IExportContentItem } from '../../export/index.js';
import { IMigrationItem } from '../../core/index.js';

interface ICsvItem {
    type: string;
    codename: string;
    name: string;
    language: string;
    collection: string;
    last_modified?: string;
    workflow_step?: string;
    [propertyName: string]: string | undefined | string[];
}

interface ITypeWrapper {
    typeCodename: string;
    items: IExportContentItem[];
    elementCodenames: string[];
}

export class ItemCsvProcessorService extends BaseItemProcessorService {
    private readonly csvDelimiter: string = ',';
    public readonly name: string = 'csv';

    async transformContentItemsAsync(data: ItemsTransformData): Promise<FileBinaryData> {
        for (const typeWrapper of this.getTypeWrappers(data.items)) {
            const contentItemsOfType = data.items
                .filter((m) => m.system.type === typeWrapper.typeCodename)
                .map((item) => this.mapToCsvItem(item, typeWrapper));
            const filename: string = `${typeWrapper.typeCodename}.csv`;

            const fieldsToStore: FieldInfo<string>[] = this.getFieldsToExport(typeWrapper);
            const languageVariantsStream = new Readable();
            languageVariantsStream.push(JSON.stringify(contentItemsOfType));
            languageVariantsStream.push(null); // required to end the stream

            const parsingProcessor = this.geCsvParser({
                fields: fieldsToStore
            }).fromInput(languageVariantsStream);

            const csvContent = (await parsingProcessor.promise()) ?? '';

            data.zip.addFile(filename, csvContent);
        }

        return await data.zip.generateZipAsync();
    }

    async parseContentItemsAsync(data: ItemsParseData): Promise<IMigrationItem[]> {
        const zipFiles = await data.zip.getAllFilesAsync<string>('string');
        const parsedItems: IMigrationItem[] = [];

        for (const file of zipFiles) {
            let index = 0;
            const parser = parse(file.data, {
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
                    const contentItem: IMigrationItem = {
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
                            const element = super.getElement(data.types, contentItemTypeCodename, columnName);

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
        }

        return parsedItems;
    }

    private getTypeWrappers(items: IExportContentItem[]): ITypeWrapper[] {
        const typeWrappers: ITypeWrapper[] = [];

        for (const item of items) {
            const existingFileData = typeWrappers.find((m) => m.typeCodename === item.system.type);

            if (!existingFileData) {
                typeWrappers.push({
                    typeCodename: item.system.type,
                    items: [item],
                    // this is with the assumption that all items of same type have the same elements defined
                    elementCodenames: item.elements.map((m) => m.codename)
                });
            } else {
                existingFileData.items.push(item);
            }
        }

        return typeWrappers;
    }

    private mapToCsvItem(item: IExportContentItem, typeWrapper: ITypeWrapper): ICsvItem {
        const csvItem: ICsvItem = {
            type: item.system.type,
            codename: item.system.codename,
            collection: item.system.collection,
            language: item.system.language,
            last_modified: item.system.last_modified,
            name: item.system.name,
            workflow_step: item.system.workflow_step
        };

        for (const elementCodename of typeWrapper.elementCodenames) {
            const itemElement = item.elements.find((m) => m.codename === elementCodename);

            if (itemElement) {
                csvItem[elementCodename] = itemElement.value;
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

    private getFieldsToExport(typeWrapper: ITypeWrapper): FieldInfo<string>[] {
        return [
            ...this.getSystemContentItemFields().map((m) => {
                const field: FieldInfo<string> = {
                    label: m,
                    value: m
                };

                return field;
            }),
            ...typeWrapper.elementCodenames.map((m) => {
                const field: FieldInfo<string> = {
                    label: m,
                    value: m
                };

                return field;
            })
        ];
    }
}
