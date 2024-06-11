import { MigrationElement, MigrationItem } from '../../../core/index.js';

export interface JsonElements {
    [elementCodename: string]: string | string[] | undefined;
}

export interface JsonItem {
    system: {
        codename: string;
        name: string;
        language: string;
        type: string;
        collection: string;
        workflow_step?: string;
        workflow?: string;
    };
    elements: JsonElements;
}

export interface TypeWrapper {
    typeCodename: string;
    items: MigrationItem[];
}

export function mapToJsonItem(item: MigrationItem): JsonItem {
    const jsonElements: JsonElements = {};

    for (const element of item.elements) {
        jsonElements[element.codename] = element.value;
    }

    const jsonItem: JsonItem = {
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

export function parseJsonItem(item: JsonItem): MigrationItem {
    const elements: MigrationElement[] = [];

    for (const propertyName of Object.keys(item.elements)) {
        elements.push({
            codename: propertyName,
            value: item.elements[propertyName]
        });
    }

    const parsedItem: MigrationItem = {
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
