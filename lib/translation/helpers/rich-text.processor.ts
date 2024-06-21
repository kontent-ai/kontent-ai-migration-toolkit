type CodenameReplaceFunc = (codename: string) => { external_id?: string; id?: string };
type IdReplaceFunc = (id: string) => { codename: string };

interface ProcessCodenamesResult {
    readonly codenames: Set<string>;
    readonly html: string;
}

interface ProcessIdsResult {
    readonly ids: Set<string>;
    readonly html: string;
}

const attributes = {
    rteCodenames: {
        rteItemCodenameAttribute: 'migration-item-codename',
        rteLinkItemCodenameAttribute: 'migration-link-item-codename',
        rteAssetCodenameAttribute: 'migration-asset-codename'
    },
    data: {
        dataNewWindowAttributeName: 'data-new-window',
        dataAssetIdAttributeName: 'data-asset-id',
        dataItemIdAttributeName: 'data-item-id',
        dataCodenameAttributeName: 'data-codename',
        dataItemExternalIdAttributeName: 'data-item-external-id',
        dataIdAttributeName: 'data-id',
        dataExternalIdAttributeName: 'data-external-id',
        dataExternalAssetIdAttributeName: 'data-asset-external-id'
    },
    componentIdentifierAttribute: 'data-type="component"'
} as const;

const rteRegexes = {
    tags: {
        objectTagRegex: new RegExp(`<object(.+?)</object>`, 'g'),
        imgTagRegex: new RegExp(`<img(.+?)</img>`, 'g'),
        figureTagRegex: new RegExp(`<figure(.+?)</figure>`, 'g'),
        linkTagRegex: new RegExp(`<a(.+?)</a>`, 'g')
    },

    attrs: {
        dataCodenameAttrRegex: new RegExp(`${attributes.data.dataCodenameAttributeName}=\\"(.+?)\\"`),
        dataItemIdAttrRegex: new RegExp(`${attributes.data.dataItemIdAttributeName}=\\"(.+?)\\"`),
        dataAssetIdAttrRegex: new RegExp(`${attributes.data.dataAssetIdAttributeName}=\\"(.+?)\\"`),
        dataIdAttrRegex: new RegExp(`${attributes.data.dataIdAttributeName}=\\"(.+?)\\"`)
    },

    rteCodenames: {
        rteItemCodenameRegex: new RegExp(`${attributes.rteCodenames.rteItemCodenameAttribute}=\\"(.+?)\\"`),
        rteLinkItemCodenameRegex: new RegExp(`${attributes.rteCodenames.rteLinkItemCodenameAttribute}=\\"(.+?)\\"`),
        rteAssetCodenameRegex: new RegExp(`${attributes.rteCodenames.rteAssetCodenameAttribute}=\\"(.+?)\\"`)
    }
} as const;

export function richTextProcessor() {
    const processDataIds: (richTextHtml: string, replaceFunc?: IdReplaceFunc) => ProcessIdsResult = (
        richTextHtml: string,
        replaceFunc?: IdReplaceFunc
    ) => {
        const itemIds = new Set<string>();

        if (!richTextHtml) {
            return {
                html: richTextHtml,
                ids: itemIds
            };
        }

        richTextHtml = richTextHtml.replaceAll(rteRegexes.tags.objectTagRegex, (objectTag) => {
            // skip processing for components
            if (objectTag.includes(attributes.componentIdentifierAttribute)) {
                return objectTag;
            }
            const itemIdMatch = objectTag.match(rteRegexes.attrs.dataIdAttrRegex);
            if (itemIdMatch && (itemIdMatch?.length ?? 0) >= 2) {
                const itemId = itemIdMatch[1];

                itemIds.add(itemId);

                if (replaceFunc) {
                    const { codename } = replaceFunc(itemId);

                    return objectTag.replaceAll(
                        `${attributes.data.dataIdAttributeName}="${itemId}"`,
                        `${attributes.rteCodenames.rteItemCodenameAttribute}="${codename}"`
                    );
                }
            }

            return objectTag;
        });

        return {
            html: richTextHtml,
            ids: itemIds
        };
    };

    const processAssetIds: (richTextHtml: string, replaceFunc?: IdReplaceFunc) => ProcessIdsResult = (
        richTextHtml,
        replaceFunc
    ) => {
        const assetIds = new Set<string>();

        if (!richTextHtml) {
            return {
                html: richTextHtml,
                ids: assetIds
            };
        }

        richTextHtml = richTextHtml.replaceAll(rteRegexes.tags.figureTagRegex, (figureTag) => {
            const assetIdMatch = figureTag.match(rteRegexes.attrs.dataAssetIdAttrRegex);
            if (assetIdMatch && (assetIdMatch?.length ?? 0) >= 2) {
                const assetId = assetIdMatch[1];

                assetIds.add(assetId);

                if (replaceFunc) {
                    const { codename } = replaceFunc(assetId);

                    return figureTag.replaceAll(
                        `${attributes.data.dataAssetIdAttributeName}="${assetId}"`,
                        `${attributes.rteCodenames.rteAssetCodenameAttribute}="${codename}"`
                    );
                }
            }

            return figureTag;
        });

        return {
            html: richTextHtml,
            ids: assetIds
        };
    };

    const processLinkItemIds: (richTextHtml: string, replaceFunc?: IdReplaceFunc) => ProcessIdsResult = (
        richTextHtml,
        replaceFunc
    ) => {
        const linkItemIds = new Set<string>();

        if (!richTextHtml) {
            return {
                html: richTextHtml,
                ids: linkItemIds
            };
        }

        richTextHtml = richTextHtml.replaceAll(rteRegexes.tags.linkTagRegex, (linkTag) => {
            const itemIdMatch = linkTag.match(rteRegexes.attrs.dataItemIdAttrRegex);
            if (itemIdMatch && (itemIdMatch?.length ?? 0) >= 2) {
                const itemId = itemIdMatch[1];
                linkItemIds.add(itemId);

                if (replaceFunc) {
                    const { codename } = replaceFunc(itemId);

                    return linkTag.replaceAll(
                        `${attributes.data.dataItemIdAttributeName}="${itemId}"`,
                        `${attributes.rteCodenames.rteLinkItemCodenameAttribute}="${codename}"`
                    );
                }
            }

            return linkTag;
        });

        return {
            html: richTextHtml,
            ids: linkItemIds
        };
    };

    const processRteItemCodenames: (
        richTextHtml: string,
        replaceFunc?: CodenameReplaceFunc
    ) => ProcessCodenamesResult = (richTextHtml, replaceFunc) => {
        const itemCodenames = new Set<string>();

        if (!richTextHtml) {
            return {
                codenames: itemCodenames,
                html: richTextHtml
            };
        }

        richTextHtml = richTextHtml.replaceAll(rteRegexes.tags.objectTagRegex, (objectTag) => {
            const codenameMatch = objectTag.match(rteRegexes.rteCodenames.rteItemCodenameRegex);
            if (codenameMatch && (codenameMatch?.length ?? 0) >= 2) {
                const codename = codenameMatch[1];

                itemCodenames.add(codename);

                if (replaceFunc) {
                    const { external_id, id } = replaceFunc(codename);

                    if (id) {
                        return objectTag.replaceAll(
                            `${attributes.rteCodenames.rteItemCodenameAttribute}="${codename}"`,
                            `${attributes.data.dataIdAttributeName}="${id}"`
                        );
                    }
                    if (external_id) {
                        return objectTag.replaceAll(
                            `${attributes.rteCodenames.rteItemCodenameAttribute}="${codename}"`,
                            `${attributes.data.dataExternalIdAttributeName}="${external_id}"`
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
    };

    const processRteLinkItemCodenames: (
        richTextHtml: string,
        replaceFunc?: CodenameReplaceFunc
    ) => ProcessCodenamesResult = (richTextHtml, replaceFunc) => {
        const itemCodenames = new Set<string>();

        if (!richTextHtml) {
            return {
                codenames: itemCodenames,
                html: richTextHtml
            };
        }

        richTextHtml = richTextHtml.replaceAll(rteRegexes.tags.linkTagRegex, (linkTag) => {
            const codenameMatch = linkTag.match(rteRegexes.rteCodenames.rteLinkItemCodenameRegex);
            if (codenameMatch && (codenameMatch?.length ?? 0) >= 2) {
                const codename = codenameMatch[1];

                itemCodenames.add(codename);

                if (replaceFunc) {
                    const { external_id, id } = replaceFunc(codename);

                    if (id) {
                        return linkTag.replaceAll(
                            `${attributes.rteCodenames.rteLinkItemCodenameAttribute}="${codename}"`,
                            `${attributes.data.dataItemIdAttributeName}="${id}"`
                        );
                    }
                    if (external_id) {
                        return linkTag.replaceAll(
                            `${attributes.rteCodenames.rteLinkItemCodenameAttribute}="${codename}"`,
                            `${attributes.data.dataItemExternalIdAttributeName}="${external_id}"`
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
    };

    const processRteAssetCodenames: (
        richTextHtml: string,
        replaceFunc?: CodenameReplaceFunc
    ) => ProcessCodenamesResult = (richTextHtml, replaceFunc) => {
        const assetCodenames = new Set<string>();

        if (!richTextHtml) {
            return {
                codenames: assetCodenames,
                html: richTextHtml
            };
        }

        richTextHtml = richTextHtml.replaceAll(rteRegexes.tags.figureTagRegex, (figureTag) => {
            const codenameMatch = figureTag.match(rteRegexes.rteCodenames.rteAssetCodenameRegex);
            if (codenameMatch && (codenameMatch?.length ?? 0) >= 2) {
                const codename = codenameMatch[1];

                assetCodenames.add(codename);

                if (replaceFunc) {
                    const { external_id, id } = replaceFunc(codename);

                    if (id) {
                        return figureTag.replaceAll(
                            `${attributes.rteCodenames.rteAssetCodenameAttribute}="${codename}"`,
                            `${attributes.data.dataAssetIdAttributeName}="${id}"`
                        );
                    }
                    if (external_id) {
                        return figureTag.replaceAll(
                            `${attributes.rteCodenames.rteAssetCodenameAttribute}="${codename}"`,
                            `${attributes.data.dataExternalAssetIdAttributeName}="${external_id}"`
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
    };

    return {
        processAssetIds,
        processDataIds,
        processLinkItemIds,
        processRteAssetCodenames,
        processRteItemCodenames,
        processRteLinkItemCodenames
    };
}
