import { RichTextHelper, getRichTextHelper } from '../../translation/rich-text-helper.js';
import {
    GetItemsByCodenames,
    ICategorizedItems,
    IItemStateInTargetEnvironment,
    IMigrationItem,
    IReferencedItemInContent,
    Log,
    getItemExternalIdForCodename,
    parseArrayValue
} from '../../core/index.js';

export function getParsedItemsHelper(log: Log): ParsedItemsHelper {
    return new ParsedItemsHelper(log);
}

export class ParsedItemsHelper {
    private readonly richTextHelper: RichTextHelper;

    constructor(log: Log) {
        this.richTextHelper = getRichTextHelper(log);
    }

    async categorizeParsedItemsAsync(
        items: IMigrationItem[],
        getItemsByCodenames: GetItemsByCodenames
    ): Promise<ICategorizedItems> {
        const itemsReferencedInContent = this.extractAllReferencedItems(items);
        const contentItems = items.filter((m) => m.system.workflow);

        const itemCodenamesToCheckInTargetEnv: string[] = [
            ...itemsReferencedInContent.map((m) => m.codename),
            ...contentItems.map((m) => m.system.codename)
        ].filter(this.uniqueStringFilter);

        const itemStates: IItemStateInTargetEnvironment[] = await this.getItemStatesAsync(
            itemCodenamesToCheckInTargetEnv,
            getItemsByCodenames
        );

        return {
            // if content item does not have a workflow step it means it is used as a component within Rich text element
            // such items are procesed within element transform
            componentItems: items.filter((m) => !m.system.workflow?.length),
            contentItems: contentItems,
            itemsReferencedInContent: itemsReferencedInContent,
            itemsInTargetEnvironment: itemStates,
            getItemStateInTargetEnvironment: (codename) => {
                const itemState = itemStates.find((m) => m.codename === codename);

                if (!itemState) {
                    throw Error(
                        `Invalid state for item '${codename}'. It is expected that all item states will be initialized`
                    );
                }

                return itemState;
            }
        };
    }

    private async getItemStatesAsync(
        itemCodenames: string[],
        getItemsByCodenames: GetItemsByCodenames
    ): Promise<IItemStateInTargetEnvironment[]> {
        const items = await getItemsByCodenames(itemCodenames);
        const itemStates: IItemStateInTargetEnvironment[] = [];

        for (const codename of itemCodenames) {
            const item = items.find((m) => m.codename === codename);
            const externalId = getItemExternalIdForCodename(codename);

            if (item) {
                itemStates.push({
                    codename: codename,
                    item: item,
                    state: 'exists',
                    externalIdToUse: externalId
                });
            } else {
                itemStates.push({
                    codename: codename,
                    item: undefined,
                    state: 'doesNotExists',
                    externalIdToUse: externalId
                });
            }
        }

        return itemStates;
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
