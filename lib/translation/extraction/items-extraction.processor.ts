import { richTextProcessor } from '../index.js';
import {
    MigrationElementModels,
    MigrationElements,
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
        const itemIds: string[] = [];
        const assetIds: string[] = [];

        for (const item of items) {
            for (const itemElement of item.elements) {
                const typeElement = getElement(item.contentTypeId, itemElement.element.id ?? '');

                if (typeElement.type === 'rich_text') {
                    const rteValue = itemElement.value?.toString();

                    itemIds.push(
                        ...[
                            ...richTextProcessor().processDataIds(rteValue ?? '').ids,
                            ...richTextProcessor().processLinkItemIds(rteValue ?? '').ids
                        ]
                    );
                    assetIds.push(...richTextProcessor().processAssetIds(rteValue ?? '').ids);

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

                    itemIds.push(...extractedComponents.itemIds);
                    assetIds.push(...extractedComponents.assetIds);
                } else if (typeElement.type === 'modular_content' || typeElement.type === 'subpages') {
                    if (itemElement.value && Array.isArray(itemElement.value)) {
                        for (const arrayVal of itemElement.value) {
                            if (!arrayVal.id) {
                                continue;
                            }
                            itemIds.push(arrayVal.id);
                        }
                    }
                } else if (typeElement.type === 'asset') {
                    if (itemElement.value && Array.isArray(itemElement.value)) {
                        for (const arrayVal of itemElement.value) {
                            if (!arrayVal.id) {
                                continue;
                            }
                            assetIds.push(arrayVal.id);
                        }
                    }
                }
            }
        }

        return {
            itemIds: itemIds.filter(uniqueStringFilter),
            assetIds: assetIds.filter(uniqueStringFilter)
        };
    };

    const extractReferencedItemsFromMigrationItems = (
        items: ExtractItemByCodename[],
        getElement: GetFlattenedElementByCodenames
    ) => {
        const itemCodenames: string[] = [];
        const assetCodenames: string[] = [];

        for (const item of items) {
            for (const [elementCodename, element] of Object.entries(item.elements)) {
                const flattenedElement = getElement(item.contentTypeCodename, elementCodename, element.type);

                if (flattenedElement.type === 'rich_text') {
                    const richTextElementValue = element as MigrationElementModels.RichTextElement;

                    if (!richTextElementValue.value) {
                        continue;
                    }

                    const richTextHtml = richTextElementValue.value?.value ?? '';

                    itemCodenames.push(
                        ...[
                            ...richTextProcessor().processRteItemCodenames(richTextHtml).codenames,
                            ...richTextProcessor().processRteLinkItemCodenames(richTextHtml).codenames
                        ]
                    );
                    assetCodenames.push(...richTextProcessor().processRteAssetCodenames(richTextHtml).codenames);

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

                    itemCodenames.push(...extractedComponents.itemCodenames);
                    assetCodenames.push(...extractedComponents.assetCodenames);
                } else if (flattenedElement.type === 'modular_content' || flattenedElement.type === 'subpages') {
                    itemCodenames.push(...parseAsMigrationReferencesArray(element.value).map((m) => m.codename));
                } else if (flattenedElement.type === 'asset') {
                    assetCodenames.push(...parseAsMigrationReferencesArray(element.value).map((m) => m.codename));
                }
            }
        }

        const data: ReferencedDataInMigrationItems = {
            itemCodenames: itemCodenames.filter(uniqueStringFilter),
            assetCodenames: assetCodenames.filter(uniqueStringFilter)
        };

        return data;
    };

    return {
        extractReferencedDataFromExtractItems,
        extractReferencedItemsFromMigrationItems
    };
}
