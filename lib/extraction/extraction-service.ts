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
    private readonly richTextHelper: RichTextHelper;

    constructor(log: Log) {
        this.richTextHelper = getRichTextHelper(log);
    }

    extractReferencedItemsFromExportItems(items: IKontentAiPreparedExportItem[]): IReferencedDataInLanguageVariants {
        const extractedIds: string[] = [];

        for (const item of items) {
            for (const typeElement of item.contentType.elements) {
                const itemElement = item.languageVariant.elements.find((m) => m.element.id === typeElement.id);

                if (!itemElement) {
                    continue;
                }

                if (typeElement.type === 'rich_text') {
                    const idsUsedWithinRte = this.richTextHelper.extractAllIdsFromManagementRte(
                        itemElement.value?.toString()
                    );

                    extractedIds.push(...idsUsedWithinRte);
                } else if (typeElement.type === 'modular_content' || typeElement.type === 'subpages') {
                    if (itemElement.value && Array.isArray(itemElement.value)) {
                        for (const arrayVal of itemElement.value) {
                            if (!arrayVal.id) {
                                continue;
                            }
                            extractedIds.push(arrayVal.id);
                        }
                    }
                }
            }
        }

        return {
            itemIds: extractedIds
        };
    }

    extractReferencedItemsFromMigrationItems(items: IMigrationItem[]): IReferencedDataInMigrationItems {
        const extractedCodenames: string[] = [];

        for (const item of items) {
            for (const element of item.elements) {
                if (element.type === 'rich_text') {
                    const codenamesUsedWithinRte = this.richTextHelper.extractAllCodenamesFromDeliveryRte(
                        element.value?.toString()
                    );

                    extractedCodenames.push(...codenamesUsedWithinRte);
                } else if (element.type === 'modular_content' || element.type === 'subpages') {
                    extractedCodenames.push(...parseArrayValue(element.value));
                }
            }
        }

        const data: IReferencedDataInMigrationItems = {
            itemCodenames: extractedCodenames.filter(uniqueStringFilter)
        };

        return data;
    }
}
