export type MigrationElementType =
    | 'text'
    | 'rich_text'
    | 'number'
    | 'multiple_choice'
    | 'date_time'
    | 'asset'
    | 'modular_content'
    | 'taxonomy'
    | 'url_slug'
    | 'guidelines'
    | 'snippet'
    | 'custom'
    | 'subpages';

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

export interface IMigrationAsset {
    binaryData: Buffer | Blob | undefined;
    assetId: string;
    filename: string;
    extension: string;
    url: string;
}
