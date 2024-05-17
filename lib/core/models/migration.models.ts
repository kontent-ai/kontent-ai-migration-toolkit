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

        workflow?: string;
        workflow_step?: string;
    };
    elements: IMigrationElement[];
}

export interface IMigrationReference {
    codename: string;
}

export interface IMigrationAssetDescription {
    language: IMigrationReference;
    description: string | undefined;
}

export interface IMigrationAsset {
    _zipFilename: string;
    binaryData: Buffer | Blob | undefined;
    filename: string;
    title: string;

    externalId?: string;
    codename?: string;
    collection?: IMigrationReference;
    descriptions?: IMigrationAssetDescription[];
}
