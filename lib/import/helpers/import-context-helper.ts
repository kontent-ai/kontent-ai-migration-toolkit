import { IImportData } from '../../toolkit/index.js';
import {
    GetItemsByCodenames,
    ICategorizedItems,
    IImportContext,
    IItemStateInTargetEnvironmentByCodename,
    IMigrationItem,
    Log,
    getItemExternalIdForCodename,
    is404Error,
    processInChunksAsync,
    uniqueStringFilter
} from '../../core/index.js';
import { ExtractionService, getExtractionService } from '../../extraction/extraction-service.js';
import { ContentItemModels, ManagementClient } from '@kontent-ai/management-sdk';

export function getImportContextHelper(log: Log, managementClient: ManagementClient): ImportContextHelper {
    return new ImportContextHelper(log, managementClient);
}

export class ImportContextHelper {
    private readonly extractionService: ExtractionService;

    constructor(private readonly log: Log, private readonly managementClient: ManagementClient) {
        this.extractionService = getExtractionService(log);
    }

    async getImportContextAsync(dataToImport: IImportData): Promise<IImportContext> {
        const importContext: IImportContext = {
            importedAssets: [],
            importedContentItems: [],
            importedLanguageVariants: [],
            categorizedItems: await this.categorizeMigrationItemsAsync(dataToImport.items, async (codenames) =>
                this.getContentItemsByCodenamesAsync({
                    itemCodenames: codenames,
                    managementClient: this.managementClient
                })
            )
        };

        return importContext;
    }

    private async getContentItemsByCodenamesAsync(data: {
        managementClient: ManagementClient;
        itemCodenames: string[];
    }): Promise<ContentItemModels.ContentItem[]> {
        const contentItems: ContentItemModels.ContentItem[] = [];

        await processInChunksAsync<string, void>({
            log: this.log,
            type: 'contentItem',
            chunkSize: 1,
            items: data.itemCodenames,
            itemInfo: (codename) => {
                return {
                    itemType: 'contentItem',
                    title: codename
                };
            },
            processFunc: async (codename) => {
                try {
                    this.log.spinner?.text?.({
                        type: 'fetch',
                        message: `${codename}`
                    });

                    const contentItem = await data.managementClient
                        .viewContentItem()
                        .byItemCodename(codename)
                        .toPromise()
                        .then((m) => m.data);

                    contentItems.push(contentItem);
                } catch (error) {
                    if (!is404Error(error)) {
                        throw error;
                    }
                }
            }
        });

        return contentItems;
    }

    private async categorizeMigrationItemsAsync(
        items: IMigrationItem[],
        getItemsByCodenames: GetItemsByCodenames
    ): Promise<ICategorizedItems> {
        const referencedData = this.extractionService.extractReferencedItemsFromMigrationItems(items);
        const contentItems = items.filter((m) => m.system.workflow);

        const itemCodenamesToCheckInTargetEnv: string[] = [
            ...referencedData.itemCodenames,
            ...contentItems.map((m) => m.system.codename)
        ].filter(uniqueStringFilter);

        const itemStates: IItemStateInTargetEnvironmentByCodename[] = await this.getItemStatesAsync(
            itemCodenamesToCheckInTargetEnv,
            getItemsByCodenames
        );

        return {
            // if content item does not have a workflow step it means it is used as a component within Rich text element
            // such items are procesed within element transform
            componentItems: items.filter((m) => !m.system.workflow?.length),
            contentItems: contentItems,
            referencedData: referencedData,
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
    ): Promise<IItemStateInTargetEnvironmentByCodename[]> {
        const items = await getItemsByCodenames(itemCodenames);
        const itemStates: IItemStateInTargetEnvironmentByCodename[] = [];

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
}
