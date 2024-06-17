import { richTextProcessor } from '../index.js';
import {
    MigrationItem,
    ReferencedDataInMigrationItems,
    parseAsMigrationReferencesArray,
    uniqueStringFilter
} from '../../core/index.js';
import { ExportItem } from '../../export/export.models.js';
import { GetFlattenedElement } from '../../import/index.js';

export function itemsExtractionProcessor() {
    const extractReferencedDataFromExportItems = (items: ExportItem[]) => {
        const itemIds: string[] = [];
        const assetIds: string[] = [];

        for (const item of items) {
            for (const typeElement of item.contentType.elements) {
                const itemElement = item.languageVariant.elements.find((m) => m.element.id === typeElement.id);

                if (!itemElement) {
                    continue;
                }

                if (typeElement.type === 'rich_text') {
                    const rteValue = itemElement.value?.toString();

                    itemIds.push(
                        ...[
                            ...richTextProcessor().processDataIds(rteValue ?? '').ids,
                            ...richTextProcessor().processLinkItemIds(rteValue ?? '').ids
                        ]
                    );
                    assetIds.push(...richTextProcessor().processAssetIds(rteValue ?? '').ids);
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

    const extractReferencedItemsFromMigrationItems = (items: MigrationItem[], getElement: GetFlattenedElement) => {
        const itemCodenames: string[] = [];
        const assetCodenames: string[] = [];

        for (const item of items) {
            for (const [elementCodename, element] of Object.entries(item.elements)) {
                const flattenedElement = getElement(item.system.type.codename, elementCodename);

                if (flattenedElement.type === 'rich_text') {
                    const richTextHtml = element.value?.toString();

                    itemCodenames.push(
                        ...[
                            ...richTextProcessor().processRteItemCodenames(richTextHtml ?? '').codenames,
                            ...richTextProcessor().processRteLinkItemCodenames(richTextHtml ?? '').codenames
                        ]
                    );
                    assetCodenames.push(...richTextProcessor().processRteAssetCodenames(richTextHtml ?? '').codenames);
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
        extractReferencedDataFromExportItems,
        extractReferencedItemsFromMigrationItems
    };
}