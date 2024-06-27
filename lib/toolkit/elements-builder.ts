import { MigrationElementModels } from '../core/index.js';

export const elementsBuilder = {
    textElement: (data: Omit<MigrationElementModels.TextElement, 'type'>): MigrationElementModels.TextElement => {
        return {
            ...data,
            type: 'text'
        };
    },
    assetElement: (data: Omit<MigrationElementModels.AssetElement, 'type'>): MigrationElementModels.AssetElement => {
        return {
            ...data,
            type: 'asset'
        };
    },
    customElement: (data: Omit<MigrationElementModels.CustomElement, 'type'>): MigrationElementModels.CustomElement => {
        return {
            ...data,
            type: 'custom'
        };
    },
    dateTimeElement: (
        data: Omit<MigrationElementModels.DateTimeElement, 'type'>
    ): MigrationElementModels.DateTimeElement => {
        return {
            ...data,
            type: 'date_time'
        };
    },
    linkedItemsElement: (
        data: Omit<MigrationElementModels.LinkedItemsElement, 'type'>
    ): MigrationElementModels.LinkedItemsElement => {
        return {
            ...data,
            type: 'modular_content'
        };
    },
    multipleChoiceElement: (
        data: Omit<MigrationElementModels.MultipleChoiceElement, 'type'>
    ): MigrationElementModels.MultipleChoiceElement => {
        return {
            ...data,
            type: 'multiple_choice'
        };
    },
    numberElement: (data: Omit<MigrationElementModels.NumberElement, 'type'>): MigrationElementModels.NumberElement => {
        return {
            ...data,
            type: 'number'
        };
    },
    richTextElement: (
        data: Omit<MigrationElementModels.RichTextElement, 'type'>
    ): MigrationElementModels.RichTextElement => {
        return {
            ...data,
            type: 'rich_text'
        };
    },
    subpagesElement: (
        data: Omit<MigrationElementModels.SubpagesElement, 'type'>
    ): MigrationElementModels.SubpagesElement => {
        return {
            ...data,
            type: 'subpages'
        };
    },
    taxonomyElement: (
        data: Omit<MigrationElementModels.TaxonomyElement, 'type'>
    ): MigrationElementModels.TaxonomyElement => {
        return {
            ...data,
            type: 'taxonomy'
        };
    },
    urlSlugElement: (
        data: Omit<MigrationElementModels.UrlSlugElement, 'type'>
    ): MigrationElementModels.UrlSlugElement => {
        return {
            ...data,
            type: 'url_slug'
        };
    }
};
