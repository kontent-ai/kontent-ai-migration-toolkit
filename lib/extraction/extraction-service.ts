import { RichTextHelper, getRichTextHelper } from '../translation/index.js';
import {
    IMigrationItem,
    IReferencedDataInLanguageVariants,
    IReferencedDataInMigrationItems,
    Log,
    parseArrayValue,
    uniqueStringFilter
} from '../core/index.js';
import { IKontentAiPreparedExportItem } from '../export/export.models.js';

export function getExtractionService(log: Log): ExtractionService {
    return new ExtractionService(log);
}

export class ExtractionService {
    private readonly richTextHelper: RichTextHelper = getRichTextHelper();

    constructor(log: Log) {}

    extractReferencedDataFromExportItems(items: IKontentAiPreparedExportItem[]): IReferencedDataInLanguageVariants {
        const itemIds: string[] = [];
        const assetIds: string[] = [];

        for (const item of items) {
            for (const typeElement of item.contentType.elements) {
                const itemElement = item.languageVariant.elements.find((m) => m.element.id === typeElement.id);

                if (!itemElement) {
                    continue;
                }

                if (typeElement.type === 'rich_text') {
                    const itemIdsWithinRte = this.richTextHelper.extractAllIdsFromManagementRte(
                        itemElement.value?.toString()
                    );

                    itemIds.push(...itemIdsWithinRte);
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

    extractReferencedItemsFromMigrationItems(items: IMigrationItem[]): IReferencedDataInMigrationItems {
        const itemCodenames: string[] = [];
        const assetCodenames: string[] = [];

        for (const item of items) {
            for (const element of item.elements) {
                if (element.type === 'rich_text') {
                    const codenamesUsedWithinRte = this.richTextHelper.extractAllCodenamesFromRte(
                        element.value?.toString()
                    );

                    itemCodenames.push(...codenamesUsedWithinRte);
                } else if (element.type === 'modular_content' || element.type === 'subpages') {
                    itemCodenames.push(...parseArrayValue(element.value));
                } else if (element.type === 'asset') {
                    assetCodenames.push(...parseArrayValue(element.value));
                }
            }
        }

        const data: IReferencedDataInMigrationItems = {
            itemCodenames: itemCodenames.filter(uniqueStringFilter),
            assetCodenames: assetCodenames.filter(uniqueStringFilter)
        };

        return data;
    }
}
