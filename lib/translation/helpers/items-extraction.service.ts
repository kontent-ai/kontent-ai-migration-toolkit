import { richTextHelper } from '../index.js';
import {
    MigrationItem,
    ReferencedDataInLanguageVariants,
    ReferencedDataInMigrationItems,
    parseAsArray,
    uniqueStringFilter
} from '../../core/index.js';
import { KontentAiPreparedExportItem } from '../../export/export.models.js';
import { GetFlattenedElement } from '../../import/index.js';

export function getItemsExtractionService(): ItemsExtractionService {
    return new ItemsExtractionService();
}

export class ItemsExtractionService {
    constructor() {}

    extractReferencedDataFromExportItems(items: KontentAiPreparedExportItem[]): ReferencedDataInLanguageVariants {
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
                            ...richTextHelper.processDataIds(rteValue ?? '').ids,
                            ...richTextHelper.processLinkItemIds(rteValue ?? '').ids
                        ]
                    );
                    assetIds.push(...richTextHelper.processAssetIds(rteValue ?? '').ids);
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
    }

    extractReferencedItemsFromMigrationItems(
        items: MigrationItem[],
        getElement: GetFlattenedElement
    ): ReferencedDataInMigrationItems {
        const itemCodenames: string[] = [];
        const assetCodenames: string[] = [];

        for (const item of items) {
            for (const element of item.elements) {
                const flattenedElement = getElement(item.system.type, element.codename);

                if (flattenedElement.type === 'rich_text') {
                    const richTextHtml = element.value?.toString();

                    itemCodenames.push(
                        ...[
                            ...richTextHelper.processRteItemCodenames(richTextHtml ?? '').codenames,
                            ...richTextHelper.processRteLinkItemCodenames(richTextHtml ?? '').codenames
                        ]
                    );
                    assetCodenames.push(...richTextHelper.processRteAssetCodenames(richTextHtml ?? '').codenames);
                } else if (flattenedElement.type === 'modular_content' || flattenedElement.type === 'subpages') {
                    itemCodenames.push(...parseAsArray(element.value));
                } else if (flattenedElement.type === 'asset') {
                    assetCodenames.push(...parseAsArray(element.value));
                }
            }
        }

        const data: ReferencedDataInMigrationItems = {
            itemCodenames: itemCodenames.filter(uniqueStringFilter),
            assetCodenames: assetCodenames.filter(uniqueStringFilter)
        };

        return data;
    }
}
