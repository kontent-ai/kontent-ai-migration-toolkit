import { richTextHelper } from '../index.js';
import {
    IMigrationItem,
    IReferencedDataInLanguageVariants,
    IReferencedDataInMigrationItems,
    Log,
    parseArrayValue,
    runWithSpinner,
    uniqueStringFilter
} from '../../core/index.js';
import { IKontentAiPreparedExportItem } from '../../export/export.models.js';

export function getItemsExtractionService(log: Log): ItemsExtractionService {
    return new ItemsExtractionService(log);
}

export class ItemsExtractionService {
    constructor(private readonly log: Log) {}

    extractReferencedDataFromExportItems(items: IKontentAiPreparedExportItem[]): IReferencedDataInLanguageVariants {
        const itemIds: string[] = [];
        const assetIds: string[] = [];

        runWithSpinner<IKontentAiPreparedExportItem, void>({
            log: this.log,
            itemInfo: (input) => {
                return {
                    title: input.requestItem.itemCodename,
                    itemType: 'exportedItem'
                };
            },
            items: items,
            process: (item) => {
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
        });

        return {
            itemIds: itemIds.filter(uniqueStringFilter),
            assetIds: assetIds.filter(uniqueStringFilter)
        };
    }

    extractReferencedItemsFromMigrationItems(items: IMigrationItem[]): IReferencedDataInMigrationItems {
        const itemCodenames: string[] = [];
        const assetCodenames: string[] = [];

        runWithSpinner<IMigrationItem, void>({
            log: this.log,
            itemInfo: (input) => {
                return {
                    title: input.system.codename,
                    itemType: 'migrationItem'
                };
            },
            items: items,
            process: (item) => {
                for (const element of item.elements) {
                    if (element.type === 'rich_text') {
                        const richTextHtml = element.value?.toString();

                        itemCodenames.push(
                            ...[
                                ...richTextHelper.processRteItemCodenames(richTextHtml ?? '').codenames,
                                ...richTextHelper.processRteLinkItemCodenames(richTextHtml ?? '').codenames
                            ]
                        );
                        assetCodenames.push(...richTextHelper.processRteAssetCodenames(richTextHtml ?? '').codenames);
                    } else if (element.type === 'modular_content' || element.type === 'subpages') {
                        itemCodenames.push(...parseArrayValue(element.value));
                    } else if (element.type === 'asset') {
                        assetCodenames.push(...parseArrayValue(element.value));
                    }
                }
            }
        });

        const data: IReferencedDataInMigrationItems = {
            itemCodenames: itemCodenames.filter(uniqueStringFilter),
            assetCodenames: assetCodenames.filter(uniqueStringFilter)
        };

        return data;
    }
}
