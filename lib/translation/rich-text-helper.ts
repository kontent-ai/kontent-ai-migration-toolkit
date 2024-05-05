export function getRichTextHelper(): RichTextHelper {
    return new RichTextHelper();
}

export class RichTextHelper {
    public readonly attributes = {
        rteCodenames: {
            rteItemCodenameAttribute: 'migration-toolkit-item-codename',
            rteLinkItemCodenameAttribute: 'migration-toolkit-link-item-codename',
            rteAssetCodenameAttribute: 'migration-toolkit-asset-codename'
        },
        data: {
            dataNewWindowAttributeName: 'data-new-window',
            dataAssetIdAttributeName: 'data-asset-id',
            dataItemIdAttributeName: 'data-item-id',
            dataItemExternalIdAttributeName: 'data-item-external-id',
            dataIdAttributeName: 'data-id',
            dataExternalIdAttributeName: 'data-external-id',
            dataExternalAssetIdAttributeName: 'data-asset-external-id'
        }
    };

    public readonly rteRegexes = {
        tags: {
            objectTagRegex: new RegExp(`<object(.+?)</object>`, 'g'),
            imgTagRegex: new RegExp(`<img(.+?)</img>`, 'g'),
            figureTagRegex: new RegExp(`<figure(.+?)</figure>`, 'g'),
            linkTagRegex: new RegExp(`<a(.+?)</a>`, 'g')
        },

        attrs: {
            dataCodenameAttrRegex: new RegExp(`data-codename=\\"(.+?)\\"`),
            dataItemIdAttrRegex: new RegExp(`${this.attributes.data.dataItemIdAttributeName}=\\"(.+?)\\"`),
            dataAssetIdAttrRegex: new RegExp(`${this.attributes.data.dataAssetIdAttributeName}=\\"(.+?)\\"`),
            dataIdAttrRegex: new RegExp(`${this.attributes.data.dataIdAttributeName}=\\"(.+?)\\"`)
        },

        rteCodenames: {
            rteItemCodenameRegex: new RegExp(`${this.attributes.rteCodenames.rteItemCodenameAttribute}=\\"(.+?)\\"`),
            rteLinkItemCodenameRegex: new RegExp(
                `${this.attributes.rteCodenames.rteLinkItemCodenameAttribute}=\\"(.+?)\\"`
            ),
            rteAssetCodenameRegex: new RegExp(`${this.attributes.rteCodenames.rteAssetCodenameAttribute}=\\"(.+?)\\"`)
        }
    } as const;

    constructor() {}

    extractDataIdsFromManagementRte(richTextHtml: string | undefined): string[] {
        if (!richTextHtml) {
            return [];
        }

        const itemIds: string[] = [];

        richTextHtml.replaceAll(this.rteRegexes.tags.objectTagRegex, (objectTag) => {
            const itemIdMatch = objectTag.match(this.rteRegexes.attrs.dataIdAttrRegex);
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

        richTextHtml.replaceAll(this.rteRegexes.tags.figureTagRegex, (figureTag) => {
            const assetIdMatch = figureTag.match(this.rteRegexes.attrs.dataAssetIdAttrRegex);
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

        richTextHtml = richTextHtml.replaceAll(this.rteRegexes.tags.linkTagRegex, (linkTag) => {
            const itemIdMatch = linkTag.match(this.rteRegexes.attrs.dataItemIdAttrRegex);
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

        richTextHtml.replaceAll(this.rteRegexes.tags.objectTagRegex, (objectTag) => {
            const codenameMatch = objectTag.match(this.rteRegexes.rteCodenames.rteItemCodenameRegex);
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

        richTextHtml.replaceAll(this.rteRegexes.tags.linkTagRegex, (linkTag) => {
            const codenameMatch = linkTag.match(this.rteRegexes.rteCodenames.rteLinkItemCodenameRegex);
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

        richTextHtml.replaceAll(this.rteRegexes.tags.figureTagRegex, (figureTag) => {
            const codenameMatch = figureTag.match(this.rteRegexes.rteCodenames.rteAssetCodenameRegex);
            if (codenameMatch && (codenameMatch?.length ?? 0) >= 2) {
                const codename = codenameMatch[1];

                assetCodenames.push(codename);
            }

            return figureTag;
        });

        return assetCodenames;
    }
}
