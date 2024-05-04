import { IImportData } from '../../toolkit/index.js';
import {
    IAssetStateInTargetEnvironmentByCodename,
    IImportContext,
    IItemStateInTargetEnvironmentByCodename,
    Log,
    getAssetExternalIdForCodename,
    getItemExternalIdForCodename,
    is404Error,
    processInChunksAsync,
    uniqueStringFilter
} from '../../core/index.js';
import { ExtractionService, getExtractionService } from '../../extraction/extraction-service.js';
import { AssetModels, ContentItemModels, ManagementClient } from '@kontent-ai/management-sdk';

export function getImportContextHelper(log: Log, managementClient: ManagementClient): ImportContextHelper {
    return new ImportContextHelper(log, managementClient);
}

export class ImportContextHelper {
    private readonly extractionService: ExtractionService;

    constructor(private readonly log: Log, private readonly managementClient: ManagementClient) {
        this.extractionService = getExtractionService(log);
    }

    async getImportContextAsync(dataToImport: IImportData): Promise<IImportContext> {
        const referencedData = this.extractionService.extractReferencedItemsFromMigrationItems(dataToImport.items);
        const contentItems = dataToImport.items.filter((m) => m.system.workflow);

        const itemCodenamesToCheckInTargetEnv: string[] = [
            ...referencedData.itemCodenames,
            ...contentItems.map((m) => m.system.codename)
        ].filter(uniqueStringFilter);

        const assetCodenamesToCheckInTargetEnv: string[] = [...referencedData.assetCodenames];

        const itemStates: IItemStateInTargetEnvironmentByCodename[] = await this.getItemStatesAsync(
            itemCodenamesToCheckInTargetEnv
        );

        const assetStates: IAssetStateInTargetEnvironmentByCodename[] = await this.getAssetStatesAsync(
            assetCodenamesToCheckInTargetEnv
        );

        const importContext: IImportContext = {
            imported: {
                assets: [],
                contentItems: [],
                languageVariants: []
            },
            // if content item does not have a workflow step it means it is used as a component within Rich text element
            // such items are procesed within element transform
            componentItems: dataToImport.items.filter((m) => !m.system.workflow?.length),
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
            },
            getAssetStateInTargetEnvironment: (codename) => {
                const assetState = assetStates.find((m) => m.codename === codename);

                if (!assetState) {
                    throw Error(
                        `Invalid state for asset '${codename}'. It is expected that all asset states will be initialized`
                    );
                }

                return assetState;
            }
        };

        return importContext;
    }

    private async getContentItemsByCodenamesAsync(itemCodenames: string[]): Promise<ContentItemModels.ContentItem[]> {
        const contentItems: ContentItemModels.ContentItem[] = [];

        await processInChunksAsync<string, void>({
            log: this.log,
            type: 'contentItem',
            chunkSize: 1,
            items: itemCodenames,
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

                    const contentItem = await this.managementClient
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

    private async getAssetsByCodenamesAsync(assetCodenames: string[]): Promise<AssetModels.Asset[]> {
        const assets: AssetModels.Asset[] = [];

        await processInChunksAsync<string, void>({
            log: this.log,
            type: 'asset',
            chunkSize: 1,
            items: assetCodenames,
            itemInfo: (codename) => {
                return {
                    itemType: 'asset',
                    title: codename
                };
            },
            processFunc: async (codename) => {
                try {
                    this.log.spinner?.text?.({
                        type: 'fetch',
                        message: `${codename}`
                    });

                    const asset = await this.managementClient
                        .viewAsset()
                        .byAssetCodename(codename)
                        .toPromise()
                        .then((m) => m.data);

                    assets.push(asset);
                } catch (error) {
                    if (!is404Error(error)) {
                        throw error;
                    }
                }
            }
        });

        return assets;
    }

    private async getItemStatesAsync(itemCodenames: string[]): Promise<IItemStateInTargetEnvironmentByCodename[]> {
        const items = await this.getContentItemsByCodenamesAsync(itemCodenames);
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

    private async getAssetStatesAsync(assetCodenames: string[]): Promise<IAssetStateInTargetEnvironmentByCodename[]> {
        const assets = await this.getAssetsByCodenamesAsync(assetCodenames);
        const assetStates: IAssetStateInTargetEnvironmentByCodename[] = [];

        for (const codename of assetCodenames) {
            const asset = assets.find((m) => m.codename === codename);
            const externalId = getAssetExternalIdForCodename(codename);

            if (asset) {
                assetStates.push({
                    codename: codename,
                    asset: asset,
                    state: 'exists',
                    externalIdToUse: externalId
                });
            } else {
                assetStates.push({
                    codename: codename,
                    asset: undefined,
                    state: 'doesNotExists',
                    externalIdToUse: externalId
                });
            }
        }

        return assetStates;
    }
}
