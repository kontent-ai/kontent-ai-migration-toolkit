import { IImportContentTypeElement } from '../../../import/index.js';
import { IExportContentItem } from '../../../export/index.js';
import { IMigrationElement, IMigrationItem } from '../../../core/index.js';

export interface IJsonElements {
    [elementCodename: string]: string | string[] | undefined;
}

export interface IJsonItem {
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

export interface ITypeWrapper {
    typeCodename: string;
    items: IExportContentItem[];
}

export function mapToJsonItem(item: IExportContentItem): IJsonItem {
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

export function parseJsonItem(
    item: IJsonItem,
    getElement: (typeCodename: string, elementCodename: string) => IImportContentTypeElement
): IMigrationItem {
    const elements: IMigrationElement[] = [];

    for (const propertyName of Object.keys(item.elements)) {
        const element = getElement(item.system.type, propertyName);

        elements.push({
            codename: propertyName,
            value: item.elements[propertyName],
            type: element.type
        });
    }

    const parsedItem: IMigrationItem = {
        system: {
            codename: item.system.codename,
            collection: item.system.collection,
            language: item.system.language,
            last_modified: item.system.last_modified,
            name: item.system.name,
            type: item.system.type,
            workflow_step: item.system.workflow_step
        },
        elements: elements
    };

    return parsedItem;
}
