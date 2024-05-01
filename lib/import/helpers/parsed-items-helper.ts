import { RichTextHelper, getRichTextHelper } from 'lib/translation/rich-text-helper.js';
import { IMigrationItem, IReferencedItemInContent, Log, parseArrayValue } from '../../core/index.js';

export interface ICategorizedParsedItems {
    componentItems: IMigrationItem[];
    contentItems: IMigrationItem[];
    itemsReferencedInContent: IReferencedItemInContent[];
}

export function getParsedItemsHelper(log: Log): ParsedItemsHelper {
    return new ParsedItemsHelper(log);
}

export class ParsedItemsHelper {
    private readonly richTextHelper: RichTextHelper;

    constructor(log: Log) {
        this.richTextHelper = getRichTextHelper(log);
    }

    categorizeParsedItems(items: IMigrationItem[]): ICategorizedParsedItems {
        return {
            // if content item does not have a workflow step it means it is used as a component within Rich text element
            // such items are procesed within element transform
            componentItems: items.filter((m) => !m.system.workflow_step?.length),
            contentItems: items.filter((m) => m.system.workflow_step?.length),
            itemsReferencedInContent: this.extractAllReferencedItems(items)
        };
    }

    private extractAllReferencedItems(items: IMigrationItem[]): IReferencedItemInContent[] {
        const extractedCodenames: string[] = [];

        for (const item of items) {
            for (const element of item.elements) {
                if (element.type === 'rich_text') {
                    const codenamesUsedWithinRte = this.richTextHelper.extractAllCodenamesFromRte(
                        element.value?.toString()
                    );

                    extractedCodenames.push(...codenamesUsedWithinRte);
                } else if (element.type === 'modular_content' || element.type === 'subpages') {
                    extractedCodenames.push(...parseArrayValue(element.value));
                }
            }
        }

        return extractedCodenames.filter(this.uniqueStringFilter).map((codename) => {
            return {
                codename: codename
            };
        });
    }

    private uniqueStringFilter(value: string, index: number, self: string[]): boolean {
        return self.indexOf(value) === index;
    }
}
