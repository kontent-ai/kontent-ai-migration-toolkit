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
    BaseMigrationItemSchema,
    BaseMigrationItemVersionSchema
} from './migration.schema.js';

export namespace MigrationElementModels {
    type MigrationElementDef<
        TElementType extends MigrationElementType = MigrationElementType,
        TValue extends MigrationElementValue = MigrationElementValue
    > = {
        readonly value: TValue;
        readonly type: TElementType;
    };

    export type TextElement = MigrationElementDef<'text', string | undefined>;
    export type NumberElement = MigrationElementDef<'number', number | undefined>;
    export type RichTextElement = MigrationElementDef<'rich_text', MigrationRichTextElementValue | undefined>;
    export type MultipleChoiceElement = MigrationElementDef<'multiple_choice', MigrationReference[] | undefined>;
    export type DateTimeElement = MigrationElementDef<'date_time', string | undefined>;
    export type AssetElement = MigrationElementDef<'asset', MigrationReference[] | undefined>;
    export type LinkedItemsElement = MigrationElementDef<'modular_content', MigrationReference[] | undefined>;
    export type TaxonomyElement = MigrationElementDef<'taxonomy', MigrationReference[] | undefined>;
    export type UrlSlugElement = MigrationElementDef<'url_slug', MigrationUrlSlugElementValue | undefined>;
    export type CustomElement = MigrationElementDef<'custom', string | undefined>;
    export type SubpagesElement = MigrationElementDef<'subpages', MigrationReference[] | undefined>;
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

export type MigrationItemVersion<TElements extends MigrationElements = MigrationElements> = z.infer<
    typeof BaseMigrationItemVersionSchema
> & {
    readonly elements: TElements;
};

export type MigrationItem<TElements extends MigrationElements = MigrationElements> = z.infer<typeof BaseMigrationItemSchema> & {
    readonly versions: MigrationItemVersion<TElements>[];
};
