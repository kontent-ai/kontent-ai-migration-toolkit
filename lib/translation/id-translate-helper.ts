import { IImportedData } from '../core/core.models.js';

interface IFlattenedImportData {
    originalId?: string;
    importedId?: string;
    originalCodename?: string;
    importedCodename?: string;
}

export class IdTranslateHelper {
    replaceIdsInRichText(text: string, importedData: IImportedData): string {
        const codename = { regex: /data-codename="(.*?)"/g, attr: 'data-id' };
        const itemId = { regex: /data-item-id="(.*?)"/g, attr: 'data-item-id' };
        const assetId = { regex: /data-asset-id="(.*?)"/g, attr: 'data-asset-id' };
        const imageId = { regex: /data-image-id="(.*?)"/g, attr: 'data-image-id' };
        const dataId = { regex: /data-id="(.*?)"/g, attr: 'data-id' };

        const flattenedImportData = this.flattenImportData(importedData);

        text = this.replaceCodenameWithRegex(codename.regex, text, codename.attr, flattenedImportData);
        text = this.replaceIdWithRegex(itemId.regex, text, itemId.attr, flattenedImportData);
        text = this.replaceIdWithRegex(assetId.regex, text, assetId.attr, flattenedImportData);
        text = this.replaceIdWithRegex(imageId.regex, text, imageId.attr, flattenedImportData);
        text = this.replaceIdWithRegex(dataId.regex, text, dataId.attr, flattenedImportData);

        return text;
    }

    private flattenImportData(importedData: IImportedData): IFlattenedImportData[] {
        const flattenedImportData: IFlattenedImportData[] = [
            ...importedData.assets.map((m) => {
                const flattened: IFlattenedImportData = {
                    importedId: m.imported.id,
                    originalId: m.original.assetId
                };

                return flattened;
            }),
            ...importedData.contentItems.map((m) => {
                const flattened: IFlattenedImportData = {
                    importedCodename: m.imported.codename,
                    importedId: m.imported.id,
                    originalCodename: m.original.system.codename
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
        return item?.importedId;
    }

    private tryFindNewIdForCodename(codename: string, items: IFlattenedImportData[]): string | undefined {
        const item = items.find((m) => m.originalCodename === codename);
        return item?.importedId;
    }
}

export const idTranslateHelper = new IdTranslateHelper();
