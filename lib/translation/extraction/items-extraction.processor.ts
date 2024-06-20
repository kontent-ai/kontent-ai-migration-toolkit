import { richTextProcessor } from '../index.js';
import {
    MigrationElementModels,
    MigrationElements,
    ReferencedDataInLanguageVariants,
    ReferencedDataInMigrationItems,
    parseAsMigrationReferencesArray,
    uniqueStringFilter
} from '../../core/index.js';
import { GetFlattenedElementByCodenames } from '../../import/index.js';
import { ElementModels } from '@kontent-ai/management-sdk';
import { GetFlattenedElementByIds } from 'lib/export/export.models.js';

interface ExtractItemById {
    elements: ElementModels.ContentItemElement[];
    contentTypeId: string;
}

interface ExtractItemByCodename {
    elements: MigrationElements;
    contentTypeCodename: string;
}

export function itemsExtractionProcessor() {
    const extractReferencedDataFromExtractItems = (items: ExtractItemById[], getElement: GetFlattenedElementByIds) => {
        const extractedIds = items.reduce<ReferencedDataInLanguageVariants>(
            (extractedIds, item) => {
                return item.elements.reduce<ReferencedDataInLanguageVariants>((childExtractedIds, itemElement) => {
                    const typeElement = getElement(item.contentTypeId, itemElement.element.id ?? '');

                    if (typeElement.type === 'rich_text') {
                        const rteValue = itemElement.value?.toString();

                        extractedIds.itemIds.push(
                            ...[
                                ...richTextProcessor().processDataIds(rteValue ?? '').ids,
                                ...richTextProcessor().processLinkItemIds(rteValue ?? '').ids
                            ]
                        );
                        extractedIds.assetIds.push(...richTextProcessor().processAssetIds(rteValue ?? '').ids);

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

                        extractedIds.itemIds.push(...extractedComponents.itemIds);
                        extractedIds.assetIds.push(...extractedComponents.assetIds);
                    } else if (typeElement.type === 'modular_content' || typeElement.type === 'subpages') {
                        if (itemElement.value && Array.isArray(itemElement.value)) {
                            itemElement.value.forEach((value) => (value.id ? extractedIds.itemIds.push(value.id) : {}));
                        }
                    } else if (typeElement.type === 'asset') {
                        if (itemElement.value && Array.isArray(itemElement.value)) {
                            itemElement.value.forEach((value) =>
                                value.id ? extractedIds.assetIds.push(value.id) : {}
                            );
                        }
                    }

                    return childExtractedIds;
                }, extractedIds);
            },
            { itemIds: [], assetIds: [] }
        );

        return <ReferencedDataInLanguageVariants>{
            itemIds: extractedIds.itemIds.filter(uniqueStringFilter),
            assetIds: extractedIds.assetIds.filter(uniqueStringFilter)
        };
    };

    const extractReferencedItemsFromMigrationItems = (
        items: ExtractItemByCodename[],
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

                            childExtractedCodenames.itemCodenames.push(
                                ...[
                                    ...richTextProcessor().processRteItemCodenames(richTextHtml).codenames,
                                    ...richTextProcessor().processRteLinkItemCodenames(richTextHtml).codenames
                                ]
                            );
                            childExtractedCodenames.assetCodenames.push(
                                ...richTextProcessor().processRteAssetCodenames(richTextHtml).codenames
                            );

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

                            childExtractedCodenames.itemCodenames.push(...extractedComponents.itemCodenames);
                            childExtractedCodenames.assetCodenames.push(...extractedComponents.assetCodenames);
                        } else if (
                            flattenedElement.type === 'modular_content' ||
                            flattenedElement.type === 'subpages'
                        ) {
                            childExtractedCodenames.itemCodenames.push(
                                ...parseAsMigrationReferencesArray(element.value).map((m) => m.codename)
                            );
                        } else if (flattenedElement.type === 'asset') {
                            childExtractedCodenames.assetCodenames.push(
                                ...parseAsMigrationReferencesArray(element.value).map((m) => m.codename)
                            );
                        }

                        return childExtractedCodenames;
                    },
                    extractedCodenames
                );
            },
            {
                itemCodenames: [],
                assetCodenames: []
            }
        );

        return <ReferencedDataInMigrationItems>{
            itemCodenames: extractedCodenames.itemCodenames.filter(uniqueStringFilter),
            assetCodenames: extractedCodenames.assetCodenames.filter(uniqueStringFilter)
        };
    };

    return {
        extractReferencedDataFromExtractItems,
        extractReferencedItemsFromMigrationItems
    };
}
