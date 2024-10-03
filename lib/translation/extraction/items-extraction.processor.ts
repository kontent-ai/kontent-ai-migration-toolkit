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
import { match, P } from 'ts-pattern';

export interface ExtractItemById {
    readonly elements: Readonly<ElementModels.ContentItemElement>[];
    readonly contentTypeId: string;
}

export interface ExtractItemByCodename {
    readonly elements: MigrationElements;
    readonly contentTypeCodename: string;
}

export interface ReferencedDataInMigrationItemsLocal {
    readonly itemCodenames: Set<string>;
    readonly assetCodenames: Set<string>;
}

export interface ReferencedDataInLanguageVariantsLocal {
    readonly itemIds: Set<string>;
    readonly assetIds: Set<string>;
}

export function itemsExtractionProcessor() {
    const extractReferencedDataFromExtractItems = (
        items: readonly ExtractItemById[],
        getElement: GetFlattenedElementByIds
    ): ReferencedDataInLanguageVariants => {
        const extractedIds = items.reduce<ReferencedDataInLanguageVariantsLocal>(
            (extractedIds, item) => {
                return item.elements.reduce<ReferencedDataInLanguageVariantsLocal>((childExtractedIds, itemElement) => {
                    const typeElement = getElement(item.contentTypeId, itemElement.element.id ?? '');

                    match(typeElement.type)
                        .with('rich_text', () => {
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

                            richTextProcessor()
                                .processLinkAssetIds(rteValue ?? '')
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
                        })
                        .with(P.union('modular_content', 'subpages'), () => {
                            if (itemElement.value && Array.isArray(itemElement.value)) {
                                itemElement.value.forEach((value) => (value.id ? extractedIds.itemIds.add(value.id) : {}));
                            }
                        })
                        .with('asset', () => {
                            if (itemElement.value && Array.isArray(itemElement.value)) {
                                itemElement.value.forEach((value) => (value.id ? extractedIds.assetIds.add(value.id) : {}));
                            }
                        })
                        .otherwise(() => {});

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
    ): ReferencedDataInMigrationItems => {
        const extractedCodenames = items.reduce<ReferencedDataInMigrationItemsLocal>(
            (extractedCodenames, item) => {
                return Object.entries(item.elements).reduce<ReferencedDataInMigrationItemsLocal>(
                    (childExtractedCodenames, [elementCodename, element]) => {
                        const flattenedElement = getElement(item.contentTypeCodename, elementCodename, element.type);

                        match(flattenedElement.type)
                            .with('rich_text', () => {
                                const richTextElementValue = element as MigrationElementModels.RichTextElement;
                                const richTextHtml = richTextElementValue.value?.value ?? '';

                                // items
                                richTextProcessor()
                                    .processItemCodenames(richTextHtml)
                                    .codenames.forEach((codename) => childExtractedCodenames.itemCodenames.add(codename));

                                richTextProcessor()
                                    .processLinkItemCodenames(richTextHtml)
                                    .codenames.forEach((codename) => childExtractedCodenames.itemCodenames.add(codename));

                                // assets
                                richTextProcessor()
                                    .processAssetCodenames(richTextHtml)
                                    .codenames.forEach((codename) => childExtractedCodenames.assetCodenames.add(codename));

                                richTextProcessor()
                                    .processLinkAssetCodenames(richTextHtml)
                                    .codenames.forEach((codename) => childExtractedCodenames.assetCodenames.add(codename));

                                // recursively extract data from components as well because they may reference additional assets & content items
                                const extractedComponents = extractReferencedItemsFromMigrationItems(
                                    (richTextElementValue.value?.components ?? []).map((component) => {
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
                            })
                            .with(P.union('modular_content', 'subpages'), () => {
                                parseAsMigrationReferencesArray(element.value)
                                    .map((m) => m.codename)
                                    .forEach((codename) => childExtractedCodenames.itemCodenames.add(codename));
                            })
                            .with('asset', () => {
                                parseAsMigrationReferencesArray(element.value)
                                    .map((m) => m.codename)
                                    .forEach((codename) => childExtractedCodenames.assetCodenames.add(codename));
                            });

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
