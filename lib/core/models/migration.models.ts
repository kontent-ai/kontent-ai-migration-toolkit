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
    | 'custom'
    | 'subpages';

export interface MigrationElement {
    readonly value: string | undefined | string[];
    readonly codename: string;
}

export interface MigrationItem {
    readonly system: {
        readonly codename: string;
        readonly name: string;
        readonly language: string;
        readonly type: string;
        readonly collection: string;

        readonly workflow?: string;
        readonly workflow_step?: string;
    };
    readonly elements: MigrationElement[];
}

export interface MigrationReference {
    readonly codename: string;
}

export interface MigrationAssetDescription {
    readonly language: MigrationReference;
    readonly description: string | undefined;
}

export interface MigrationAsset {
    readonly _zipFilename: string;
    readonly codename: string;
    readonly binaryData: Buffer | Blob | undefined;
    readonly filename: string;
    readonly title: string;

    readonly collection?: MigrationReference;
    readonly descriptions?: MigrationAssetDescription[];
}
