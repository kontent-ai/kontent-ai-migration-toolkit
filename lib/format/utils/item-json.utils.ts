import {
    MigrationElement,
    MigrationElementType,
    MigrationElementValue,
    MigrationItem,
    MigrationReference
} from '../../core/index.js';

export interface JsonElements {
    [elementCodename: string]: JsonElement;
}

export interface JsonElement {
    type: MigrationElementType;
    value: MigrationElementValue;
}

export interface JsonItem {
    readonly system: {
        readonly codename: string;
        readonly name: string;
        readonly language: MigrationReference;
        readonly type: MigrationReference;
        readonly collection: MigrationReference;
        readonly workflow_step?: MigrationReference;
        readonly workflow?: MigrationReference;
    };
    readonly elements: JsonElements;
}

export interface TypeWrapper {
    readonly typeCodename: string;
    readonly items: MigrationItem[];
}

export function mapToJsonItem(item: MigrationItem): JsonItem {
    const jsonElements: JsonElements = {};

    for (const element of item.elements) {
        jsonElements[element.codename] = {
            type: element.type,
            value: element.value
        };
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
    const elements: MigrationElement[] = Object.entries(item.elements).map((m) => {
        const migrationElement: MigrationElement = {
            codename: m[0],
            type: m[1].type,
            value: m[1].value
        };

        return migrationElement;
    });
    const parsedItem: MigrationItem = {
        system: {
            name: item.system.name,
            codename: item.system.codename,
            language: item.system.language,
            type: item.system.type,
            collection: item.system.collection,
            workflow_step: item.system.workflow_step,
            workflow: item.system.workflow
        },
        elements: elements
    };

    return parsedItem;
}
