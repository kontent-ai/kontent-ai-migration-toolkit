import { richTextProcessor } from '../index.js';
import {
    MigrationElementModels,
    MigrationElements,
    ReferencedDataInLanguageVariants,
    ReferencedDataInMigrationItems,
    parseAsMigrationReferencesArray
} from '../../core/index.js';
import { GetFlattenedElementByCodenames } from '../../import/index.js';
import { ElementModels } from '@kontent-ai/management-sdk';
import { GetFlattenedElementByIds } from 'lib/export/export.models.js';

interface ExtractItemById {
    readonly elements: ElementModels.ContentItemElement[];
    readonly contentTypeId: string;
}

interface ExtractItemByCodename {
    readonly elements: MigrationElements;
    readonly contentTypeCodename: string;
}

export function itemsExtractionProcessor() {
    const extractReferencedDataFromExtractItems = (
        items: readonly ExtractItemById[],
        getElement: GetFlattenedElementByIds
    ) => {
        const extractedIds = items.reduce<ReferencedDataInLanguageVariants>(
            (extractedIds, item) => {
                return item.elements.reduce<ReferencedDataInLanguageVariants>((childExtractedIds, itemElement) => {
                    const typeElement = getElement(item.contentTypeId, itemElement.element.id ?? '');

                    if (typeElement.type === 'rich_text') {
                        const rteValue = itemElement.value?.toString();

                        // extract referenced items
                        richTextProcessor()
                            .processDataIds(rteValue ?? '')
                            .ids.forEach((id) => extractedIds.itemIds.add(id));

                        richTextProcessor()
                            .processLinkItemIds(rteValue ?? '')
                            .ids.forEach((id) => extractedIds.itemIds.add(id));

                        // extract referenced assets
                        richTextProcessor()
                            .processAssetIds(rteValue ?? '')
                            .ids.forEach((id) => extractedIds.assetIds.add(id));

                        // recursively extract data from components as well because they may reference additional assets & content items
                        const extractedComponents = extractReferencedDataFromExtractItems(
                            itemElement.components.map((component) => {
                                return {
                                    contentTypeId: component.type.id ?? '',
                                    elements: component.elements
                                };
                            }),
                            getElement
                        );

                        extractedComponents.itemIds.forEach((id) => extractedIds.itemIds.add(id));
                        extractedComponents.assetIds.forEach((id) => extractedIds.assetIds.add(id));
                    } else if (typeElement.type === 'modular_content' || typeElement.type === 'subpages') {
                        if (itemElement.value && Array.isArray(itemElement.value)) {
                            itemElement.value.forEach((value) => (value.id ? extractedIds.itemIds.add(value.id) : {}));
                        }
                    } else if (typeElement.type === 'asset') {
                        if (itemElement.value && Array.isArray(itemElement.value)) {
                            itemElement.value.forEach((value) => (value.id ? extractedIds.assetIds.add(value.id) : {}));
                        }
                    }

                    return childExtractedIds;
                }, extractedIds);
            },
            { itemIds: new Set(), assetIds: new Set() }
        );

        return <ReferencedDataInLanguageVariants>{
            itemIds: extractedIds.itemIds,
            assetIds: extractedIds.assetIds
        };
    };

    const extractReferencedItemsFromMigrationItems = (
        items: readonly ExtractItemByCodename[],
        getElement: GetFlattenedElementByCodenames
    ) => {
        const extractedCodenames = items.reduce<ReferencedDataInMigrationItems>(
            (extractedCodenames, item) => {
                return Object.entries(item.elements).reduce<ReferencedDataInMigrationItems>(
                    (childExtractedCodenames, [elementCodename, element]) => {
                        const flattenedElement = getElement(item.contentTypeCodename, elementCodename, element.type);

                        if (flattenedElement.type === 'rich_text') {
                            const richTextElementValue = element as MigrationElementModels.RichTextElement;

                            if (!richTextElementValue.value) {
                                return childExtractedCodenames;
                            }

                            const richTextHtml = richTextElementValue.value?.value ?? '';

                            // items
                            richTextProcessor()
                                .processRteItemCodenames(richTextHtml)
                                .codenames.forEach((codename) => childExtractedCodenames.itemCodenames.add(codename));

                            richTextProcessor()
                                .processRteLinkItemCodenames(richTextHtml)
                                .codenames.forEach((codename) => childExtractedCodenames.itemCodenames.add(codename));

                            // assets
                            richTextProcessor()
                                .processRteAssetCodenames(richTextHtml)
                                .codenames.forEach((codename) => childExtractedCodenames.assetCodenames.add(codename));

                            // recursively extract data from components as well because they may reference additional assets & content items
                            const extractedComponents = extractReferencedItemsFromMigrationItems(
                                richTextElementValue.value.components.map((component) => {
                                    const extractionItem: ExtractItemByCodename = {
                                        contentTypeCodename: component.system.type.codename,
                                        elements: component.elements
                                    };

                                    return extractionItem;
                                }),
                                getElement
                            );

                            extractedComponents.itemCodenames.forEach((codename) =>
                                childExtractedCodenames.itemCodenames.add(codename)
                            );
                            extractedComponents.assetCodenames.forEach((codename) =>
                                childExtractedCodenames.assetCodenames.add(codename)
                            );
                        } else if (
                            flattenedElement.type === 'modular_content' ||
                            flattenedElement.type === 'subpages'
                        ) {
                            parseAsMigrationReferencesArray(element.value)
                                .map((m) => m.codename)
                                .forEach((codename) => childExtractedCodenames.itemCodenames.add(codename));
                        } else if (flattenedElement.type === 'asset') {
                            parseAsMigrationReferencesArray(element.value)
                                .map((m) => m.codename)
                                .forEach((codename) => childExtractedCodenames.assetCodenames.add(codename));
                        }

                        return childExtractedCodenames;
                    },
                    extractedCodenames
                );
            },
            {
                itemCodenames: new Set(),
                assetCodenames: new Set()
            }
        );

        return <ReferencedDataInMigrationItems>{
            itemCodenames: extractedCodenames.itemCodenames,
            assetCodenames: extractedCodenames.assetCodenames
        };
    };

    return {
        extractReferencedDataFromExtractItems,
        extractReferencedItemsFromMigrationItems
    };
}
