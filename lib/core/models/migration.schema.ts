import { z } from 'zod';

interface Elements {
    readonly [key: string]: Element;
}

type UrlSlugMode = 'autogenerated' | 'custom';

type UrlSlugElementValue = {
    readonly value?: string;
    readonly mode: UrlSlugMode;
};

type Reference = { readonly codename: string };

type Component = {
    readonly system: {
        readonly id: string;
        readonly type: Reference;
    };
    readonly elements: Elements;
};

type RichTextElementValue = {
    readonly value: string;
    readonly components: Readonly<Component[]>;
};

type ElementValue = string | undefined | number | Reference[] | RichTextElementValue | UrlSlugElementValue;

type Element = {
    readonly type: ElementType;
    readonly value?: ElementValue;
};

type ElementType =
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

export const MigrationUrlSlugModeSchema = z.enum(['autogenerated', 'custom']).readonly();
export const MigrationElementTypeSchema = z
    .enum([
        'text',
        'rich_text',
        'number',
        'multiple_choice',
        'date_time',
        'asset',
        'modular_content',
        'taxonomy',
        'url_slug',
        'custom',
        'subpages'
    ])
    .readonly();

export const MigrationReferenceSchema = z
    .strictObject({
        codename: z.string().readonly()
    })
    .readonly();

export const ScheduleSchema = z
    .strictObject({
        publish_time: z.string().datetime().optional().readonly(),
        publish_display_timezone: z.string().optional().readonly(),
        unpublish_time: z.string().datetime().optional().readonly(),
        unpublish_display_timezone: z.string().optional().readonly()
    })
    .readonly();

/**
 * ZodType is needed to be specified here due to the use of 'lazy' & circular dependency between types
 * Otherwise TS has no way of statically inferring the type
 */
export const MigrationElementsSchema: z.ZodReadonly<z.ZodType<Elements>> = z
    .record(
        z.string(),
        z.lazy(() => MigrationElementSchema)
    )
    .readonly();

export const MigrationComponentSchema = z
    .strictObject({
        system: z.strictObject({
            id: z.string(),
            type: MigrationReferenceSchema
        }),
        elements: MigrationElementsSchema
    })
    .readonly();

export const MigrationUrlSlugElementValueSchema = z
    .strictObject({
        value: z.optional(z.string()),
        mode: MigrationUrlSlugModeSchema
    })
    .readonly();

export const MigrationRichTextElementValueSchema = z
    .strictObject({
        value: z.string(),
        components: z.array(MigrationComponentSchema).readonly()
    })
    .readonly();

export const MigrationElementValueSchema = z.union([
    z.string(),
    z.undefined(),
    z.number(),
    z.array(MigrationReferenceSchema),
    MigrationRichTextElementValueSchema,
    MigrationUrlSlugElementValueSchema
]);

export const MigrationElementSchema = z
    .strictObject({
        type: MigrationElementTypeSchema,
        value: MigrationElementValueSchema
    })
    .readonly();

export const MigrationItemVersionSchema = z
    .strictObject({
        workflow_step: MigrationReferenceSchema,
        elements: MigrationElementsSchema,
        schedule: ScheduleSchema
    })
    .readonly();

export const MigrationItemSystemSchema = z.strictObject({
    codename: z.string(),
    name: z.string(),
    language: MigrationReferenceSchema,
    type: MigrationReferenceSchema,
    collection: MigrationReferenceSchema,
    workflow: MigrationReferenceSchema
});

export const MigrationItemSchema = z
    .strictObject({
        system: MigrationItemSystemSchema,
        versions: z.array(MigrationItemVersionSchema).readonly()
    })
    .readonly();

export const MigrationAssetDescriptionSchema = z
    .strictObject({
        language: MigrationReferenceSchema,
        description: z.optional(z.string())
    })
    .readonly();

const BaseMigrationAssetSchema = z.strictObject({
    codename: z.string(),
    filename: z.string(),
    title: z.string(),
    collection: z.optional(MigrationReferenceSchema),
    descriptions: z.optional(z.array(MigrationAssetDescriptionSchema)).readonly(),
    folder: z.optional(MigrationReferenceSchema)
});

export const MigrationAssetSchema = BaseMigrationAssetSchema.extend({
    binaryData: z.union([z.instanceof(Buffer), z.instanceof(Blob)])
}).readonly();

export const ZipMigrationAssetSchema = BaseMigrationAssetSchema.extend({
    _zipFilename: z.string()
}).readonly();

export const MigrationAssetsSchema = z.array(MigrationAssetSchema).readonly();
export const ZipMigrationAssetsSchema = z.array(ZipMigrationAssetSchema).readonly();
export const MigrationItemsSchema = z.array(MigrationItemSchema).readonly();

export const MigrationDataSchema = z
    .strictObject({
        items: MigrationItemsSchema,
        assets: MigrationAssetsSchema
    })
    .readonly();
