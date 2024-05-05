type CodenameReplaceFunc = (codename: string) => { external_id?: string; id?: string };
type IdReplaceFunc = (id: string) => { codename: string };

interface IProcessCodenamesResult {
    codenames: string[];
    html: string;
}

interface IProcessIdsResult {
    ids: string[];
    html: string;
}

export function getRichTextService(): RichTextService {
    return new RichTextService();
}

export class RichTextService {
    private readonly attributes = {
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
    } as const;

    private readonly rteRegexes = {
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

    processDataIds(richTextHtml: string, replaceFunc?: IdReplaceFunc): IProcessIdsResult {
        if (!richTextHtml) {
            return {
                html: richTextHtml,
                ids: []
            };
        }

        const itemIds: string[] = [];

        richTextHtml = richTextHtml.replaceAll(this.rteRegexes.tags.objectTagRegex, (objectTag) => {
            const itemIdMatch = objectTag.match(this.rteRegexes.attrs.dataIdAttrRegex);
            if (itemIdMatch && (itemIdMatch?.length ?? 0) >= 2) {
                const itemId = itemIdMatch[1];

                itemIds.push(itemId);

                if (replaceFunc) {
                    const { codename } = replaceFunc(itemId);

                    return objectTag.replaceAll(
                        `${this.attributes.data.dataIdAttributeName}="${itemId}"`,
                        `${this.attributes.rteCodenames.rteItemCodenameAttribute}="${codename}"`
                    );
                }
            }

            return objectTag;
        });

        return {
            html: richTextHtml,
            ids: itemIds
        };
    }

    processAssetIds(richTextHtml: string, replaceFunc?: IdReplaceFunc): IProcessIdsResult {
        if (!richTextHtml) {
            return {
                html: richTextHtml,
                ids: []
            };
        }

        const assetIds: string[] = [];

        richTextHtml = richTextHtml.replaceAll(this.rteRegexes.tags.figureTagRegex, (figureTag) => {
            const assetIdMatch = figureTag.match(this.rteRegexes.attrs.dataAssetIdAttrRegex);
            if (assetIdMatch && (assetIdMatch?.length ?? 0) >= 2) {
                const assetId = assetIdMatch[1];

                assetIds.push(assetId);

                if (replaceFunc) {
                    const { codename } = replaceFunc(assetId);

                    return figureTag.replaceAll(
                        `${this.attributes.data.dataAssetIdAttributeName}="${assetId}"`,
                        `${this.attributes.rteCodenames.rteAssetCodenameAttribute}="${codename}"`
                    );
                }
            }

            return figureTag;
        });

        return {
            html: richTextHtml,
            ids: assetIds
        };
    }

    processLinkItemIds(richTextHtml: string, replaceFunc?: IdReplaceFunc): IProcessIdsResult {
        if (!richTextHtml) {
            return {
                html: richTextHtml,
                ids: []
            };
        }

        const linkItemIds: string[] = [];

        richTextHtml = richTextHtml.replaceAll(this.rteRegexes.tags.linkTagRegex, (linkTag) => {
            const itemIdMatch = linkTag.match(this.rteRegexes.attrs.dataItemIdAttrRegex);
            if (itemIdMatch && (itemIdMatch?.length ?? 0) >= 2) {
                const itemId = itemIdMatch[1];
                linkItemIds.push(itemId);

                if (replaceFunc) {
                    const { codename } = replaceFunc(itemId);

                    return linkTag.replaceAll(
                        `${this.attributes.data.dataItemIdAttributeName}="${itemId}"`,
                        `${this.attributes.rteCodenames.rteLinkItemCodenameAttribute}="${codename}"`
                    );
                }
            }

            return linkTag;
        });

        return {
            html: richTextHtml,
            ids: linkItemIds
        };
    }

    processRteItemCodenames(richTextHtml: string, replaceFunc?: CodenameReplaceFunc): IProcessCodenamesResult {
        if (!richTextHtml) {
            return {
                codenames: [],
                html: richTextHtml
            };
        }

        const itemCodenames: string[] = [];

        richTextHtml = richTextHtml.replaceAll(this.rteRegexes.tags.objectTagRegex, (objectTag) => {
            const codenameMatch = objectTag.match(this.rteRegexes.rteCodenames.rteItemCodenameRegex);
            if (codenameMatch && (codenameMatch?.length ?? 0) >= 2) {
                const codename = codenameMatch[1];

                itemCodenames.push(codename);

                if (replaceFunc) {
                    const { external_id, id } = replaceFunc(codename);

                    if (id) {
                        return objectTag.replaceAll(
                            `${this.attributes.rteCodenames.rteItemCodenameAttribute}="${codename}"`,
                            `${this.attributes.data.dataIdAttributeName}="${id}"`
                        );
                    }
                    if (external_id) {
                        return objectTag.replaceAll(
                            `${this.attributes.rteCodenames.rteItemCodenameAttribute}="${codename}"`,
                            `${this.attributes.data.dataExternalIdAttributeName}="${external_id}"`
                        );
                    }
                }
            }

            return objectTag;
        });

        return {
            codenames: itemCodenames,
            html: richTextHtml
        };
    }

    processRteLinkItemCodenames(richTextHtml: string, replaceFunc?: CodenameReplaceFunc): IProcessCodenamesResult {
        if (!richTextHtml) {
            return {
                codenames: [],
                html: richTextHtml
            };
        }

        const itemCodenames: string[] = [];

        richTextHtml = richTextHtml.replaceAll(this.rteRegexes.tags.linkTagRegex, (linkTag) => {
            const codenameMatch = linkTag.match(this.rteRegexes.rteCodenames.rteLinkItemCodenameRegex);
            if (codenameMatch && (codenameMatch?.length ?? 0) >= 2) {
                const codename = codenameMatch[1];

                itemCodenames.push(codename);

                if (replaceFunc) {
                    const { external_id, id } = replaceFunc(codename);

                    if (id) {
                        return linkTag.replaceAll(
                            `${this.attributes.rteCodenames.rteLinkItemCodenameAttribute}="${codename}"`,
                            `${this.attributes.data.dataItemIdAttributeName}="${id}"`
                        );
                    }
                    if (external_id) {
                        return linkTag.replaceAll(
                            `${this.attributes.rteCodenames.rteLinkItemCodenameAttribute}="${codename}"`,
                            `${this.attributes.data.dataItemExternalIdAttributeName}="${external_id}"`
                        );
                    }
                }
            }

            return linkTag;
        });

        return {
            codenames: itemCodenames,
            html: richTextHtml
        };
    }

    processRteAssetCodenames(richTextHtml: string, replaceFunc?: CodenameReplaceFunc): IProcessCodenamesResult {
        if (!richTextHtml) {
            return {
                codenames: [],
                html: richTextHtml
            };
        }

        const assetCodenames: string[] = [];

        richTextHtml = richTextHtml.replaceAll(this.rteRegexes.tags.figureTagRegex, (figureTag) => {
            const codenameMatch = figureTag.match(this.rteRegexes.rteCodenames.rteAssetCodenameRegex);
            if (codenameMatch && (codenameMatch?.length ?? 0) >= 2) {
                const codename = codenameMatch[1];

                assetCodenames.push(codename);

                if (replaceFunc) {
                    const { external_id, id } = replaceFunc(codename);

                    if (id) {
                        return figureTag.replaceAll(
                            `${this.attributes.rteCodenames.rteAssetCodenameAttribute}="${codename}"`,
                            `${this.attributes.data.dataAssetIdAttributeName}="${id}"`
                        );
                    }
                    if (external_id) {
                        return figureTag.replaceAll(
                            `${this.attributes.rteCodenames.rteAssetCodenameAttribute}="${codename}"`,
                            `${this.attributes.data.dataExternalAssetIdAttributeName}="${external_id}"`
                        );
                    }
                }
            }

            return figureTag;
        });

        return {
            codenames: assetCodenames,
            html: richTextHtml
        };
    }
}
