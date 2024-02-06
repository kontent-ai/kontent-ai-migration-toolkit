import { ElementModels } from '@kontent-ai/management-sdk';

export type MigrationElementType = ElementModels.ElementType;

export interface IMigrationElement {
    value: string | undefined | string[];
    type: MigrationElementType;
    codename: string;
}

export interface IMigrationItem {
    system: {
        codename: string;
        name: string;
        language: string;
        type: string;
        collection: string;
        last_modified?: string;
        workflow_step?: string;
    };
    elements: IMigrationElement[];
}

export interface IMigrationAssetRecord {
    assetId: string;
    filename: string;
    extension: string;
    url: string;
}

export interface IMigrationAsset extends IMigrationAssetRecord {
    binaryData: Buffer | Blob | undefined;
}
