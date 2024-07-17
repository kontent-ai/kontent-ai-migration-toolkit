import { z } from 'zod';
import {
    MigrationComponentSchema,
    MigrationElementTypeSchema,
    MigrationElementValueSchema,
    MigrationReferenceSchema,
    MigrationUrlSlugElementValueSchema,
    MigrationUrlSlugModeSchema,
    MigrationRichTextElementValueSchema,
    MigrationElementSchema,
    MigrationElementsSchema,
    MigrationAssetDescriptionSchema,
    MigrationDataSchema,
    MigrationAssetSchema,
    MigrationItemVersionSchema,
    MigrationItemSchema
} from './migration.schema.js';

export namespace MigrationElementModels {
    type MigrationElementDef<
        TElementType extends MigrationElementType = MigrationElementType,
        TValue extends MigrationElementValue = MigrationElementValue
    > = {
        readonly value: TValue | undefined;
        readonly type: TElementType;
    };

    export type TextElement = MigrationElementDef<'text', string>;
    export type NumberElement = MigrationElementDef<'number', number>;
    export type RichTextElement = MigrationElementDef<'rich_text', MigrationRichTextElementValue>;
    export type MultipleChoiceElement = MigrationElementDef<'multiple_choice', MigrationReference[]>;
    export type DateTimeElement = MigrationElementDef<'date_time', string>;
    export type AssetElement = MigrationElementDef<'asset', MigrationReference[]>;
    export type LinkedItemsElement = MigrationElementDef<'modular_content', MigrationReference[]>;
    export type TaxonomyElement = MigrationElementDef<'taxonomy', MigrationReference[]>;
    export type UrlSlugElement = MigrationElementDef<'url_slug', MigrationUrlSlugElementValue>;
    export type CustomElement = MigrationElementDef<'custom', string>;
    export type SubpagesElement = MigrationElementDef<'subpages', MigrationReference[]>;
}

export type MigrationReference = z.infer<typeof MigrationReferenceSchema>;
export type MigrationUrlSlugMode = z.infer<typeof MigrationUrlSlugModeSchema>;
export type MigrationElementType = z.infer<typeof MigrationElementTypeSchema>;
export type MigrationUrlSlugElementValue = z.infer<typeof MigrationUrlSlugElementValueSchema>;
export type MigrationRichTextElementValue = z.infer<typeof MigrationRichTextElementValueSchema>;
export type MigrationComponent = z.infer<typeof MigrationComponentSchema>;
export type MigrationElementValue = z.infer<typeof MigrationElementValueSchema>;
export type MigrationElement = z.infer<typeof MigrationElementSchema>;
export type MigrationElements = z.infer<typeof MigrationElementsSchema>;
export type MigrationAssetDescription = z.infer<typeof MigrationAssetDescriptionSchema>;
export type MigrationAsset = z.infer<typeof MigrationAssetSchema>;
export type MigrationData = z.infer<typeof MigrationDataSchema>;

export type MigrationItemVersion<TElements extends MigrationElements = MigrationElements> = z.infer<typeof MigrationItemVersionSchema> & {
    readonly elements: Readonly<TElements>;
};

export type MigrationItem<TElements extends MigrationElements = MigrationElements> = z.infer<typeof MigrationItemSchema> & {
    readonly versions: Readonly<MigrationItemVersion<TElements>[]>;
};
