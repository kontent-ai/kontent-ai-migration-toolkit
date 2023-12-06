import { IParsedContentItem } from 'lib/index.js';

export interface ICategorizedParsedItems {
    componentItems: IParsedContentItem[];
    regularItems: IParsedContentItem[];
}

export class ParsedItemsHelper {
    categorizeParsedItems(items: IParsedContentItem[]): ICategorizedParsedItems {
        return {
            // if content item does not have a workflow step it means it is used as a component within Rich text element
            // such items are procesed within element transform
            componentItems: items.filter((m) => !m.system.workflow_step?.length),
            regularItems: items.filter((m) => m.system.workflow_step?.length)
        };
    }
}

export const parsedItemsHelper = new ParsedItemsHelper();
