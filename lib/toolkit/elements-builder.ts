import { MigrationElementModels } from '../core/index.js';

export function elementsBuilder() {
    const textElement: (data: Omit<MigrationElementModels.TextElement, 'type'>) => MigrationElementModels.TextElement = (
        data
    ) => {
        return {
            ...data,
            type: 'text'
        };
    };

    const assetElement: (data: Omit<MigrationElementModels.AssetElement, 'type'>) => MigrationElementModels.AssetElement = (
        data
    ) => {
        return {
            ...data,
            type: 'asset'
        };
    };

    const customElement: (data: Omit<MigrationElementModels.CustomElement, 'type'>) => MigrationElementModels.CustomElement = (
        data
    ) => {
        return {
            ...data,
            type: 'custom'
        };
    };

    const dateTimeElement: (
        data: Omit<MigrationElementModels.DateTimeElement, 'type'>
    ) => MigrationElementModels.DateTimeElement = (data) => {
        return {
            ...data,
            type: 'date_time'
        };
    };

    const linkedItemsElement: (
        data: Omit<MigrationElementModels.LinkedItemsElement, 'type'>
    ) => MigrationElementModels.LinkedItemsElement = (data) => {
        return {
            ...data,
            type: 'modular_content'
        };
    };

    const multipleChoiceElement: (
        data: Omit<MigrationElementModels.MultipleChoiceElement, 'type'>
    ) => MigrationElementModels.MultipleChoiceElement = (data) => {
        return {
            ...data,
            type: 'multiple_choice'
        };
    };

    const numberElement: (data: Omit<MigrationElementModels.NumberElement, 'type'>) => MigrationElementModels.NumberElement = (
        data
    ) => {
        return {
            ...data,
            type: 'number'
        };
    };

    const richTextElement: (
        data: Omit<MigrationElementModels.RichTextElement, 'type'>
    ) => MigrationElementModels.RichTextElement = (data) => {
        return {
            ...data,
            type: 'rich_text'
        };
    };

    const subpagesElement: (
        data: Omit<MigrationElementModels.SubpagesElement, 'type'>
    ) => MigrationElementModels.SubpagesElement = (data) => {
        return {
            ...data,
            type: 'subpages'
        };
    };

    const taxonomyElement: (
        data: Omit<MigrationElementModels.TaxonomyElement, 'type'>
    ) => MigrationElementModels.TaxonomyElement = (data) => {
        return {
            ...data,
            type: 'taxonomy'
        };
    };

    const urlSlugElement: (data: Omit<MigrationElementModels.UrlSlugElement, 'type'>) => MigrationElementModels.UrlSlugElement = (
        data
    ) => {
        return {
            ...data,
            type: 'url_slug'
        };
    };

    return {
        textElement,
        assetElement,
        customElement,
        richTextElement,
        numberElement,
        subpagesElement,
        multipleChoiceElement,
        urlSlugElement,
        taxonomyElement,
        linkedItemsElement,
        dateTimeElement
    };
}
