import { IImportContentType, IParsedContentItem, IParsedElement } from '../../import/index.js';
import { IFileData } from '../file-processor.models.js';
import { BaseItemProcessorService } from '../base-item-processor.service.js';
import { IExportContentItem } from '../../export/index.js';

interface IJsonElements {
    [elementCodename: string]: string | string[] | undefined;
}

interface IJsonItem {
    system: {
        codename: string;
        name: string;
        language: string;
        type: string;
        collection: string;
        last_modified?: string;
        workflow_step?: string;
    };
    elements: IJsonElements;
}

interface ITypeWrapper {
    typeCodename: string;
    items: IExportContentItem[];
}

export class ItemJsonProcessorService extends BaseItemProcessorService {
    public readonly name: string = 'json';

    async transformContentItemsAsync(items: IExportContentItem[]): Promise<IFileData[]> {
        const fileData: IFileData[] = [];
        const typeWrappers: ITypeWrapper[] = this.getTypeWrappers(items);
        for (const typeWrapper of typeWrappers) {
            const filename: string = `${typeWrapper.typeCodename}.json`;
            const contentItemsOfType = items.filter((m) => m.system.type === typeWrapper.typeCodename);
            const jsonItems: IJsonItem[] = contentItemsOfType.map((m) => this.mapToJsonItem(m));

            fileData.push({
                data: jsonItems.length ? JSON.stringify(jsonItems) : '[]',
                filename: filename,
                itemsCount: jsonItems.length
            });
        }

        return fileData;
    }

    async parseContentItemsAsync(text: string, types: IImportContentType[]): Promise<IParsedContentItem[]> {
        const parsedItems: IParsedContentItem[] = [];
        const rawItems: IJsonItem[] = JSON.parse(text) as IJsonItem[];

        for (const rawItem of rawItems) {
            const elements: IParsedElement[] = [];

            for (const propertyName of Object.keys(rawItem.elements)) {
                const element = super.getElement(types, rawItem.system.type, propertyName);

                elements.push({
                    codename: propertyName,
                    value: rawItem.elements[propertyName],
                    type: element.type
                });
            }

            const parsedItem: IParsedContentItem = {
                system: {
                    codename: rawItem.system.codename,
                    collection: rawItem.system.collection,
                    language: rawItem.system.language,
                    last_modified: rawItem.system.last_modified,
                    name: rawItem.system.name,
                    type: rawItem.system.type,
                    workflow_step: rawItem.system.workflow_step
                },
                elements: elements
            };

            parsedItems.push(parsedItem);
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
                    items: [item]
                });
            } else {
                existingFileData.items.push(item);
            }
        }

        return typeWrappers;
    }

    private mapToJsonItem(item: IExportContentItem): IJsonItem {
        const jsonElements: IJsonElements = {};

        for (const element of item.elements) {
            jsonElements[element.codename] = element.value;
        }

        const jsonItem: IJsonItem = {
            system: {
                codename: item.system.codename,
                collection: item.system.collection,
                language: item.system.language,
                last_modified: item.system.last_modified,
                name: item.system.name,
                type: item.system.type,
                workflow_step: item.system.workflow_step
            },
            elements: jsonElements
        };
        return jsonItem;
    }
}
