import { IFlattenedContentTypeElement, IMigrationElement, IMigrationItem } from '../../../core/index.js';

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
        workflow_step?: string;
        workflow?: string;
    };
    elements: IJsonElements;
}

export interface ITypeWrapper {
    typeCodename: string;
    items: IMigrationItem[];
}

export function mapToJsonItem(item: IMigrationItem): IJsonItem {
    const jsonElements: IJsonElements = {};

    for (const element of item.elements) {
        jsonElements[element.codename] = element.value;
    }

    const jsonItem: IJsonItem = {
        system: {
            codename: item.system.codename,
            collection: item.system.collection,
            language: item.system.language,
            name: item.system.name,
            type: item.system.type,
            workflow_step: item.system.workflow_step,
            workflow: item.system.workflow
        },
        elements: jsonElements
    };
    return jsonItem;
}

export function parseJsonItem(
    item: IJsonItem,
    getElement: (typeCodename: string, elementCodename: string) => IFlattenedContentTypeElement
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
            name: item.system.name,
            type: item.system.type,
            workflow_step: item.system.workflow_step,
            workflow: item.system.workflow
        },
        elements: elements
    };

    return parsedItem;
}
