import { IImportItemResult } from './core.models';

export class IdTranslateHelper {
    replaceIdsInRichText(text: string, items: IImportItemResult[]): string {
        const codename = { regex: /data-codename="(.*?)"/g, attr: 'data-id' };
        const itemId = { regex: /data-item-id="(.*?)"/g, attr: 'data-item-id' };
        const assetId = { regex: /data-asset-id="(.*?)"/g, attr: 'data-asset-id' };
        const imageId = { regex: /data-image-id="(.*?)"/g, attr: 'data-image-id' };
        const dataId = { regex: /data-id="(.*?)"/g, attr: 'data-id' };

        text = this.replaceCodenameWithRegex(codename.regex, text, codename.attr, items);
        text = this.replaceIdWithRegex(itemId.regex, text, itemId.attr, items);
        text = this.replaceIdWithRegex(assetId.regex, text, assetId.attr, items);
        text = this.replaceIdWithRegex(imageId.regex, text, imageId.attr, items);
        text = this.replaceIdWithRegex(dataId.regex, text, dataId.attr, items);

        return text;
    }

    private replaceIdWithRegex(regex: RegExp, text: string, replaceAttr: string, items: IImportItemResult[]): string {
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
        items: IImportItemResult[]
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

    private tryFindNewId(id: string, items: IImportItemResult[]): string | undefined {
        const item = items.find((m) => m.originalId === id);
        return item?.importId;
    }

    private tryFindNewIdForCodename(codename: string, items: IImportItemResult[]): string | undefined {
        const item = items.find((m) => m.originalCodename === codename);
        return item?.importId;
    }
}

export const idTranslateHelper = new IdTranslateHelper();
