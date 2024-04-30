import { IMigrationItem } from '../../core/index.js';

export interface ICategorizedParsedItems {
    componentItems: IMigrationItem[];
    contentItems: IMigrationItem[];
}

export class ParsedItemsHelper {
    categorizeParsedItems(items: IMigrationItem[]): ICategorizedParsedItems {
        return {
            // if content item does not have a workflow step it means it is used as a component within Rich text element
            // such items are procesed within element transform
            componentItems: items.filter((m) => !m.system.workflow_step?.length),
            contentItems: items.filter((m) => m.system.workflow_step?.length)
        };
    }
}

export const parsedItemsHelper = new ParsedItemsHelper();
