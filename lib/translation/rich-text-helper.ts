export function getRichTextHelper(): RichTextHelper {
    return new RichTextHelper();
}

export class RichTextHelper {
    public readonly rteItemCodenameAttribute: string = 'migration-toolkit-item-codename' as const;
    public readonly linkCodenameAttributeName: string = 'data-manager-link-codename' as const;
    public readonly dataNewWindowAttributeName: string = 'data-new-window' as const;
    public readonly dataItemIdAttributeName: string = 'data-item-id' as const;
    public readonly dataIdAttributeName: string = 'data-id' as const;
    public readonly dataExternalIdAttributeName: string = 'data-external-id' as const;

    public readonly rteRegexes = {
        objectRegex: new RegExp(`<object(.+?)</object>`, 'g'),
        dataCodenameRegex: new RegExp(`data-codename=\\"(.+?)\\"`),
        dataItemIdRegex: new RegExp(`${this.dataItemIdAttributeName}=\\"(.+?)\\"`),
        dataIdRegex: new RegExp(`${this.dataIdAttributeName}=\\"(.+?)\\"`),

        linkRegex: new RegExp(`<a(.+?)</a>`, 'g'),
        csvmLinkCodenameRegex: new RegExp(`${this.linkCodenameAttributeName}=\\"(.+?)\\"`),

        rteItemCodenameRegex: new RegExp(`${this.rteItemCodenameAttribute}=\\"(.+?)\\"`)
    } as const;

    constructor() {}

    extractAllIdsFromManagementRte(richTextHtml: string | undefined): string[] {
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

    extractAllCodenamesFromRte(richTextHtml: string | undefined): string[] {
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
}
