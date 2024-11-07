import { z } from 'zod';
import {
    MigrationAssetDescriptionSchema,
    MigrationAssetSchema,
    MigrationComponentSchema,
    MigrationDataSchema,
    MigrationElementSchema,
    MigrationElementsSchema,
    MigrationElementTypeSchema,
    MigrationElementValueSchema,
    MigrationItemSchema,
    MigrationItemSystemSchema,
    MigrationItemVersionSchema,
    MigrationReferenceSchema,
    MigrationUrlSlugModeSchema
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
    export type RichTextElement = MigrationElementDef<'rich_text', string> & Pick<MigrationElement, 'components'>;
    export type MultipleChoiceElement = MigrationElementDef<'multiple_choice', MigrationReference[]>;
    export type DateTimeElement = MigrationElementDef<'date_time', string> & Pick<MigrationElement, 'display_timezone'>;
    export type AssetElement = MigrationElementDef<'asset', MigrationReference[]>;
    export type LinkedItemsElement = MigrationElementDef<'modular_content', MigrationReference[]>;
    export type TaxonomyElement = MigrationElementDef<'taxonomy', MigrationReference[]>;
    export type UrlSlugElement = MigrationElementDef<'url_slug', string> & Pick<MigrationElement, 'mode'>;
    export type CustomElement = MigrationElementDef<'custom', string>;
    export type SubpagesElement = MigrationElementDef<'subpages', MigrationReference[]>;
}

export type MigrationReference<T extends string = string> = z.infer<typeof MigrationReferenceSchema> & {
    readonly codename: T;
};

export type MigrationItemSystem<
    TTypeCodenames extends string = string,
    TLanguageCodenames extends string = string,
    TCollectionCodenames extends string = string,
    TWorkflowCodenames extends string = string
> = z.infer<typeof MigrationItemSystemSchema> & {
    readonly codename: string;
    readonly name: string;
    readonly language: MigrationReference<TLanguageCodenames>;
    readonly type: MigrationReference<TTypeCodenames>;
    readonly collection: MigrationReference<TCollectionCodenames>;
    readonly workflow: MigrationReference<TWorkflowCodenames>;
};
export type MigrationUrlSlugMode = z.infer<typeof MigrationUrlSlugModeSchema>;
export type MigrationElementType = z.infer<typeof MigrationElementTypeSchema>;
export type MigrationComponent = z.infer<typeof MigrationComponentSchema>;
export type MigrationElementValue = z.infer<typeof MigrationElementValueSchema>;
export type MigrationElement = z.infer<typeof MigrationElementSchema>;
export type MigrationElementTransformData = Omit<MigrationElement, 'type'>;
export type MigrationElements = z.infer<typeof MigrationElementsSchema>;
export type MigrationAssetDescription = z.infer<typeof MigrationAssetDescriptionSchema>;
export type MigrationAsset = z.infer<typeof MigrationAssetSchema>;
export type MigrationData = z.infer<typeof MigrationDataSchema>;

export type MigrationItemVersion<
    TElements extends MigrationElements = MigrationElements,
    TWorkflowStepCodenames extends string = string
> = z.infer<typeof MigrationItemVersionSchema> & {
    readonly elements: Readonly<TElements>;
    readonly workflow_step: MigrationReference<TWorkflowStepCodenames>;
};

export type MigrationItem<
    TElements extends MigrationElements = MigrationElements,
    TSystem extends MigrationItemSystem = MigrationItemSystem,
    TWorkflowStepCodenames extends string = string
> = z.infer<typeof MigrationItemSchema> & {
    readonly versions: Readonly<MigrationItemVersion<TElements, TWorkflowStepCodenames>[]>;
    readonly system: TSystem;
};
