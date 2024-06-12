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
    /**
     * Value of the element
     */
    readonly value: string | undefined | string[];
    /**
     * Codename of the element
     */
    readonly codename: string;
}

export interface MigrationItem {
    readonly system: {
        /**
         * Codename of the content item
         */
        readonly codename: string;
        /**
         * Name of the content item
         */
        readonly name: string;
        /**
         * Language codename of language variant
         */
        readonly language: string;
        /**
         * Content type codename that content item uses
         */
        readonly type: string;
        /**
         * Optional
         * Codename of the collection
         */
        readonly collection: string;

        /**
         * Codename of the workflow
         * Undefined only if migration item represents components in RTE
         */
        readonly workflow?: string;
        /**
         * Codename of the workflow step
         * Undefined only if migration item represents components in RTE
         */
        readonly workflow_step?: string;
    };
    readonly elements: MigrationElement[];
}

export interface MigrationReference {
    /**
     * Codename of the referenced object
     */
    readonly codename: string;
}

export interface MigrationAssetDescription {
    readonly language: MigrationReference;
    readonly description: string | undefined;
}

export interface MigrationAsset {
    /**
     * Name of the file used in zip package. Only used for purposes of this library.
     */
    readonly _zipFilename: string;
    /**
     * Codename of the asset
     */
    readonly codename: string;
    /**
     * Binary data of the asset
     */
    readonly binaryData: Buffer | Blob | undefined;
    /**
     * Filename of the asset, will be used as a filename in Kontent.ai after importing the asset
     */
    readonly filename: string;
    /**
     * Title of the asset
     */
    readonly title: string;

    /**
     * Optional
     * Collection of the asset
     */
    readonly collection?: MigrationReference;

    /**
     * Optional.
     * Descriptions of the assets
     */
    readonly descriptions?: MigrationAssetDescription[];
}
