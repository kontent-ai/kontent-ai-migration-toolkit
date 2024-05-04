import { ContentItemModels } from '@kontent-ai/management-sdk';
import { IImportContext } from '../core/core.models.js';

interface IFlattenedImportData {
    originalId?: string;
    newId?: string;
    originalCodename?: string;
}

export class IdTranslateHelper {
    replaceIdsInRichText(text: string, importContext: IImportContext): string {
        const codename = { regex: /data-codename="(.*?)"/g, attr: 'data-id' };
        const itemId = { regex: /data-item-id="(.*?)"/g, attr: 'data-item-id' };
        const assetId = { regex: /data-asset-id="(.*?)"/g, attr: 'data-asset-id' };
        const imageId = { regex: /data-image-id="(.*?)"/g, attr: 'data-image-id' };
        const dataId = { regex: /data-id="(.*?)"/g, attr: 'data-id' };

        const flattenedImportData = this.flattenImportDataWithIds(importContext);

        text = this.replaceCodenameWithRegex(codename.regex, text, codename.attr, flattenedImportData);
        text = this.replaceIdWithRegex(itemId.regex, text, itemId.attr, flattenedImportData);
        text = this.replaceIdWithRegex(assetId.regex, text, assetId.attr, flattenedImportData);
        text = this.replaceIdWithRegex(imageId.regex, text, imageId.attr, flattenedImportData);
        text = this.replaceIdWithRegex(dataId.regex, text, dataId.attr, flattenedImportData);

        // it may happen that not all ids were replaced, replace remaining ids with external ids
        text = this.replaceIdsWithExternalIdsInRichText(text, importContext);

        return text;
    }

    private replaceIdsWithExternalIdsInRichText(text: string, importContext: IImportContext): string {
        const codename = { regex: /data-codename="(.*?)"/g, attr: 'data-external-id' };
        const itemId = { regex: /data-item-id="(.*?)"/g, attr: 'data-item-external-id' };

        const flattenedImportData = this.flattenImportDataWithExternalIds(importContext);

        text = this.replaceCodenameWithRegex(codename.regex, text, codename.attr, flattenedImportData);
        text = this.replaceIdWithRegex(itemId.regex, text, itemId.attr, flattenedImportData);

        return text;
    }

    private flattenImportDataWithIds(importContext: IImportContext): IFlattenedImportData[] {
        const flattenedImportData: IFlattenedImportData[] = [
            ...importContext.imported.assets.map((m) => {
                const flattened: IFlattenedImportData = {
                    newId: m.imported.id,
                   // originalId: m.original.assetId
                };

                return flattened;
            }),
            ...importContext.imported.contentItems.map((m) => {
                const flattened: IFlattenedImportData = {
                    newId: m.imported.id,
                    originalCodename: m.original.system.codename
                };

                return flattened;
            }),
            ...importContext.itemsInTargetEnvironment
                .filter((m) => m.item)
                .map((m) => {
                    const item = m.item as ContentItemModels.ContentItem;
                    const flattened: IFlattenedImportData = {
                        newId: item.id,
                        originalCodename: m.codename
                    };

                    return flattened;
                })
        ];

        return flattenedImportData;
    }

    private flattenImportDataWithExternalIds(importContext: IImportContext): IFlattenedImportData[] {
        const flattenedImportData: IFlattenedImportData[] = [
            ...importContext.itemsInTargetEnvironment.map((m) => {
                const flattened: IFlattenedImportData = {
                    newId: m.externalIdToUse,
                    originalCodename: m.codename
                };

                return flattened;
            })
        ];

        return flattenedImportData;
    }

    private replaceIdWithRegex(
        regex: RegExp,
        text: string,
        replaceAttr: string,
        items: IFlattenedImportData[]
    ): string {
        return text.replace(regex, (a, b) => {
            if (b) {
                const newId = this.tryFindNewId(b, items);

                if (newId) {
                    return `${replaceAttr}="${newId}"`;
                }
            }

            return a;
        });
    }

    private replaceCodenameWithRegex(
        regex: RegExp,
        text: string,
        replaceAttr: string,
        items: IFlattenedImportData[]
    ): string {
        return text.replace(regex, (a, b) => {
            if (b) {
                const newId = this.tryFindNewIdForCodename(b, items);
                if (newId) {
                    return `${replaceAttr}="${newId}"`;
                }
            }

            return a;
        });
    }

    private tryFindNewId(id: string, items: IFlattenedImportData[]): string | undefined {
        const item = items.find((m) => m.originalId === id);
        return item?.newId;
    }

    private tryFindNewIdForCodename(codename: string, items: IFlattenedImportData[]): string | undefined {
        const item = items.find((m) => m.originalCodename === codename);
        return item?.newId;
    }
}

export const idTranslateHelper = new IdTranslateHelper();
