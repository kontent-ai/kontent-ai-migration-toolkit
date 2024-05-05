export function getRichTextHelper(): RichTextHelper {
    return new RichTextHelper();
}

export class RichTextHelper {
    public readonly rteItemCodenameAttribute: string = 'migration-toolkit-item-codename' as const;
    public readonly rteLinkItemCodenameAttribute: string = 'migration-toolkit-link-item-codename' as const;
    public readonly rteAssetCodenameAttribute: string = 'migration-toolkit-asset-codename' as const;

    public readonly linkCodenameAttributeName: string = 'data-manager-link-codename' as const;
    public readonly dataNewWindowAttributeName: string = 'data-new-window' as const;
    public readonly dataAssetIdAttributeName: string = 'data-asset-id' as const;
    public readonly dataItemIdAttributeName: string = 'data-item-id' as const;
    public readonly dataItemExternalIdAttributeName: string = 'data-item-external-id' as const;
    public readonly dataIdAttributeName: string = 'data-id' as const;
    public readonly dataExternalIdAttributeName: string = 'data-external-id' as const;
    public readonly dataExternalAssetIdAttributeName: string = 'data-asset-external-id' as const;

    public readonly rteRegexes = {
        objectRegex: new RegExp(`<object(.+?)</object>`, 'g'),
        imgRegex: new RegExp(`<img(.+?)</img>`, 'g'),
        figureRegex: new RegExp(`<figure(.+?)</figure>`, 'g'),
        dataCodenameRegex: new RegExp(`data-codename=\\"(.+?)\\"`),
        dataItemIdRegex: new RegExp(`${this.dataItemIdAttributeName}=\\"(.+?)\\"`),
        dataAssetIdRegex: new RegExp(`${this.dataAssetIdAttributeName}=\\"(.+?)\\"`),
        dataIdRegex: new RegExp(`${this.dataIdAttributeName}=\\"(.+?)\\"`),

        linkRegex: new RegExp(`<a(.+?)</a>`, 'g'),
        csvmLinkCodenameRegex: new RegExp(`${this.linkCodenameAttributeName}=\\"(.+?)\\"`),

        rteItemCodenameRegex: new RegExp(`${this.rteItemCodenameAttribute}=\\"(.+?)\\"`),
        rteLinkItemCodenameRegex: new RegExp(`${this.rteLinkItemCodenameAttribute}=\\"(.+?)\\"`),
        rteAssetCodenameRegex: new RegExp(`${this.rteAssetCodenameAttribute}=\\"(.+?)\\"`)
    } as const;

    constructor() {}

    extractDataIdsFromManagementRte(richTextHtml: string | undefined): string[] {
        if (!richTextHtml) {
            return [];
        }

        const itemIds: string[] = [];

        richTextHtml.replaceAll(this.rteRegexes.objectRegex, (objectTag) => {
            const itemIdMatch = objectTag.match(this.rteRegexes.dataIdRegex);
            if (itemIdMatch && (itemIdMatch?.length ?? 0) >= 2) {
                const itemId = itemIdMatch[1];

                itemIds.push(itemId);
            }

            return objectTag;
        });

        return itemIds;
    }

    extractAssetIdsFromManagementRte(richTextHtml: string | undefined): string[] {
        if (!richTextHtml) {
            return [];
        }

        const assetIds: string[] = [];

        richTextHtml.replaceAll(this.rteRegexes.figureRegex, (figureTag) => {
            const assetIdMatch = figureTag.match(this.rteRegexes.dataAssetIdRegex);
            if (assetIdMatch && (assetIdMatch?.length ?? 0) >= 2) {
                const assetId = assetIdMatch[1];

                assetIds.push(assetId);
            }

            return figureTag;
        });

        return assetIds;
    }

    extracLinkItemIdsFromManagementRte(richTextHtml: string | undefined): string[] {
        if (!richTextHtml) {
            return [];
        }

        const linkItemIds: string[] = [];

        richTextHtml = richTextHtml.replaceAll(this.rteRegexes.linkRegex, (linkTag) => {
            const itemIdMatch = linkTag.match(this.rteRegexes.dataItemIdRegex);
            if (itemIdMatch && (itemIdMatch?.length ?? 0) >= 2) {
                const itemId = itemIdMatch[1];
                linkItemIds.push(itemId);
            }

            return linkTag;
        });

        return linkItemIds;
    }

    extractRteItemCodenames(richTextHtml: string | undefined): string[] {
        if (!richTextHtml) {
            return [];
        }

        const itemCodenames: string[] = [];

        richTextHtml.replaceAll(this.rteRegexes.objectRegex, (objectTag) => {
            const codenameMatch = objectTag.match(this.rteRegexes.rteItemCodenameRegex);
            if (codenameMatch && (codenameMatch?.length ?? 0) >= 2) {
                const codename = codenameMatch[1];

                itemCodenames.push(codename);
            }

            return objectTag;
        });

        return itemCodenames;
    }

    extractRteLinkItemCodenames(richTextHtml: string | undefined): string[] {
        if (!richTextHtml) {
            return [];
        }

        const itemCodenames: string[] = [];

        richTextHtml.replaceAll(this.rteRegexes.linkRegex, (linkTag) => {
            const codenameMatch = linkTag.match(this.rteRegexes.rteLinkItemCodenameRegex);
            if (codenameMatch && (codenameMatch?.length ?? 0) >= 2) {
                const codename = codenameMatch[1];

                itemCodenames.push(codename);
            }

            return linkTag;
        });

        return itemCodenames;
    }

    extractRteAssetCodenames(richTextHtml: string | undefined): string[] {
        if (!richTextHtml) {
            return [];
        }

        const assetCodenames: string[] = [];

        richTextHtml.replaceAll(this.rteRegexes.figureRegex, (figureTag) => {
            const codenameMatch = figureTag.match(this.rteRegexes.rteAssetCodenameRegex);
            if (codenameMatch && (codenameMatch?.length ?? 0) >= 2) {
                const codename = codenameMatch[1];

                assetCodenames.push(codename);
            }

            return figureTag;
        });

        return assetCodenames;
    }
}
