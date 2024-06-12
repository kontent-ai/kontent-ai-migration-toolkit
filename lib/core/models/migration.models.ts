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

export namespace MigrationElements {
    export interface TextElement extends MigrationElement {}
    export interface NumberElement extends MigrationElement {}
    export interface RichTextElement extends MigrationElement {}
    export interface MultipleChoiceElement extends MigrationElement {}
    export interface DateTimeElement extends MigrationElement {}
    export interface AssetElement extends MigrationElement {}
    export interface LinkedItemsElement extends MigrationElement {}
    export interface TaxonomyElement extends MigrationElement {}
    export interface UrlSlugElement extends MigrationElement {}
    export interface CustomElement extends MigrationElement {}
    export interface SubpagesElement extends MigrationElement {}
}

export type MigrationElementValue = string | undefined | MigrationReference[] | number;

export interface MigrationElement {
    /**
     * Value of the element
     */
    readonly value: MigrationElementValue;

    /**
     * Codename of the element
     */
    readonly codename: string;

    /**
     * Type of the element
     */
    readonly type: MigrationElementType;
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
         * Language of the language variant
         */
        readonly language: MigrationReference;
        /**
         * Content type of the item
         */
        readonly type: MigrationReference;
        /**
         * Collection of the item
         */
        readonly collection: MigrationReference;

        /**
         * Undefined only if migration item represents components in RTE
         */
        readonly workflow?: MigrationReference;
        /**
         * Undefined only if migration item represents components in RTE
         */
        readonly workflow_step?: MigrationReference;
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
