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

export interface MigrationElement {
    value: string | undefined | string[];
    codename: string;
}

export interface MigrationItem {
    system: {
        codename: string;
        name: string;
        language: string;
        type: string;
        collection: string;

        workflow?: string;
        workflow_step?: string;
    };
    elements: MigrationElement[];
}

export interface MigrationReference {
    codename: string;
}

export interface MigrationAssetDescription {
    language: MigrationReference;
    description: string | undefined;
}

export interface MigrationAsset {
    _zipFilename: string;
    codename: string;
    binaryData: Buffer | Blob | undefined;
    filename: string;
    title: string;

    externalId?: string;
    collection?: MigrationReference;
    descriptions?: MigrationAssetDescription[];
}
