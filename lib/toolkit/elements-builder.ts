import { MigrationElements } from '../core/index.js';

export function elementsBuilder() {
    const textElement: (data: Omit<MigrationElements.TextElement, 'type'>) => MigrationElements.TextElement = (
        data
    ) => {
        return {
            ...data,
            type: 'text'
        };
    };

    const assetElement: (data: Omit<MigrationElements.AssetElement, 'type'>) => MigrationElements.AssetElement = (
        data
    ) => {
        return {
            ...data,
            type: 'asset'
        };
    };

    const customElement: (data: Omit<MigrationElements.CustomElement, 'type'>) => MigrationElements.CustomElement = (
        data
    ) => {
        return {
            ...data,
            type: 'custom'
        };
    };

    const dateTimeElement: (
        data: Omit<MigrationElements.DateTimeElement, 'type'>
    ) => MigrationElements.DateTimeElement = (data) => {
        return {
            ...data,
            type: 'date_time'
        };
    };

    const linkedItemsElement: (
        data: Omit<MigrationElements.LinkedItemsElement, 'type'>
    ) => MigrationElements.LinkedItemsElement = (data) => {
        return {
            ...data,
            type: 'modular_content'
        };
    };

    const multipleChoiceElement: (
        data: Omit<MigrationElements.MultipleChoiceElement, 'type'>
    ) => MigrationElements.MultipleChoiceElement = (data) => {
        return {
            ...data,
            type: 'multiple_choice'
        };
    };

    const numberElement: (data: Omit<MigrationElements.NumberElement, 'type'>) => MigrationElements.NumberElement = (
        data
    ) => {
        return {
            ...data,
            type: 'number'
        };
    };

    const richTextElement: (
        data: Omit<MigrationElements.RichTextElement, 'type'>
    ) => MigrationElements.RichTextElement = (data) => {
        return {
            ...data,
            type: 'rich_text'
        };
    };

    const subpagesElement: (
        data: Omit<MigrationElements.SubpagesElement, 'type'>
    ) => MigrationElements.SubpagesElement = (data) => {
        return {
            ...data,
            type: 'subpages'
        };
    };

    const taxonomyElement: (
        data: Omit<MigrationElements.TaxonomyElement, 'type'>
    ) => MigrationElements.TaxonomyElement = (data) => {
        return {
            ...data,
            type: 'taxonomy'
        };
    };

    const urlSlugElement: (data: Omit<MigrationElements.UrlSlugElement, 'type'>) => MigrationElements.UrlSlugElement = (
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
