import {
    IAssetStateInTargetEnvironmentByCodename,
    IItemStateInTargetEnvironmentByCodename,
    ILanguageVariantStateInTargetEnvironmentByCodename,
    IMigrationItem,
    Log,
    getAssetExternalIdForCodename,
    getItemExternalIdForCodename,
    is404Error,
    processInChunksAsync,
    runMapiRequestAsync,
    uniqueStringFilter
} from '../../../core/index.js';

import { AssetModels, ContentItemModels, LanguageVariantModels, ManagementClient } from '@kontent-ai/management-sdk';
import { IImportContext, IImportData } from '../../import.models.js';
import { ItemsExtractionService, getItemsExtractionService } from '../../../translation/index.js';

interface ILanguageVariantWrapper {
    languageVariant: LanguageVariantModels.ContentItemLanguageVariant;
    migrationItem: IMigrationItem;
}

export function getImportContextService(log: Log, managementClient: ManagementClient): ImportContextService {
    return new ImportContextService(log, managementClient);
}

export class ImportContextService {
    private readonly itemsExtractionService: ItemsExtractionService;

    constructor(private readonly log: Log, private readonly managementClient: ManagementClient) {
        this.itemsExtractionService = getItemsExtractionService(log);
    }

    async getImportContextAsync(importData: IImportData): Promise<IImportContext> {
        const referencedData = this.itemsExtractionService.extractReferencedItemsFromMigrationItems(importData.items);
        const contentItemsExcludingComponents = importData.items.filter(
            (m) => m.system.workflow && m.system.workflow_step
        );

        // check all items, including referenced items in content
        const itemCodenamesToCheckInTargetEnv: string[] = [
            ...referencedData.itemCodenames,
            ...contentItemsExcludingComponents.map((m) => m.system.codename)
        ].filter(uniqueStringFilter);

        // only load language variants for items to migrate, no need to get it for referenced items
        const languageVariantToCheckInTargetEnv: IMigrationItem[] = contentItemsExcludingComponents;

        // check all assets, including referenced assets in content
        const assetCodenamesToCheckInTargetEnv: string[] = [
            ...referencedData.assetCodenames,
            ...importData.assets.map((m) => m.codename).filter(uniqueStringFilter)
        ];

        const itemStates: IItemStateInTargetEnvironmentByCodename[] = await this.getItemStatesAsync(
            itemCodenamesToCheckInTargetEnv
        );

        const variantStates: ILanguageVariantStateInTargetEnvironmentByCodename[] = await this.getVariantStatesAsync(
            languageVariantToCheckInTargetEnv
        );

        const assetStates: IAssetStateInTargetEnvironmentByCodename[] = await this.getAssetStatesAsync(
            assetCodenamesToCheckInTargetEnv
        );

        const importContext: IImportContext = {
            // if content item does not have a workflow step it means it is used as a component within Rich text element
            // such items are procesed within element transform
            componentItems: importData.items.filter((m) => !m.system.workflow?.length),
            contentItems: contentItemsExcludingComponents,
            referencedData: referencedData,
            itemsInTargetEnvironment: itemStates,
            getItemStateInTargetEnvironment: (itemCodename) => {
                const itemState = itemStates.find((m) => m.itemCodename === itemCodename);

                if (!itemState) {
                    throw Error(
                        `Invalid state for item '${itemCodename}'. It is expected that all item states will be initialized`
                    );
                }

                return itemState;
            },
            getLanguageVariantStateInTargetEnvironment: (itemCodename, languageCodename) => {
                const variantState = variantStates.find(
                    (m) => m.itemCodename === itemCodename && m.languageCodename === languageCodename
                );

                if (!variantState) {
                    throw Error(
                        `Invalid state for language variant '${itemCodename}' in language '${languageCodename}'. It is expected that all variant states will be initialized`
                    );
                }

                return variantState;
            },
            getAssetStateInTargetEnvironment: (assetCodename) => {
                const assetState = assetStates.find((m) => m.assetCodename === assetCodename);

                if (!assetState) {
                    throw Error(
                        `Invalid state for asset '${assetCodename}'. It is expected that all asset states will be initialized`
                    );
                }

                return assetState;
            }
        };

        return importContext;
    }

    private async getLanguageVariantsAsync(migrationItems: IMigrationItem[]): Promise<ILanguageVariantWrapper[]> {
        const languageVariants: ILanguageVariantWrapper[] = [];

        await processInChunksAsync<IMigrationItem, void>({
            log: this.log,
            chunkSize: 1,
            items: migrationItems,
            itemInfo: (item) => {
                return {
                    itemType: 'languageVariant',
                    title: `${item.system.codename} (${item.system.language})`
                };
            },
            processFunc: async (item) => {
                try {
                    const variant = await runMapiRequestAsync({
                        log: this.log,
                        func: async () =>
                            (
                                await this.managementClient
                                    .viewLanguageVariant()
                                    .byItemCodename(item.system.codename)
                                    .byLanguageCodename(item.system.language)
                                    .toPromise()
                            ).data,
                        action: 'view',
                        type: 'languageVariant',
                        useSpinner: true,
                        itemName: `byCodename -> ${item.system.codename} (${item.system.language})`
                    });

                    languageVariants.push({
                        languageVariant: variant,
                        migrationItem: item
                    });
                } catch (error) {
                    if (!is404Error(error)) {
                        throw error;
                    }
                }
            }
        });

        return languageVariants;
    }

    private async getContentItemsByCodenamesAsync(itemCodenames: string[]): Promise<ContentItemModels.ContentItem[]> {
        const contentItems: ContentItemModels.ContentItem[] = [];

        await processInChunksAsync<string, void>({
            log: this.log,
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
                    const contentItem = await runMapiRequestAsync({
                        log: this.log,
                        func: async () =>
                            (
                                await this.managementClient.viewContentItem().byItemCodename(codename).toPromise()
                            ).data,
                        action: 'view',
                        type: 'contentItem',
                        useSpinner: true,
                        itemName: `codename -> ${codename}`
                    });

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
                    const asset = await runMapiRequestAsync({
                        log: this.log,
                        func: async () =>
                            (
                                await this.managementClient.viewAsset().byAssetCodename(codename).toPromise()
                            ).data,
                        action: 'view',
                        type: 'asset',
                        useSpinner: true,
                        itemName: `codename -> ${codename}`
                    });

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

    private async getVariantStatesAsync(
        migrationItems: IMigrationItem[]
    ): Promise<ILanguageVariantStateInTargetEnvironmentByCodename[]> {
        const variants = await this.getLanguageVariantsAsync(migrationItems);
        const variantStates: ILanguageVariantStateInTargetEnvironmentByCodename[] = [];

        for (const migrationItem of migrationItems) {
            const variant = variants.find(
                (m) =>
                    m.migrationItem.system.codename === migrationItem.system.codename &&
                    m.migrationItem.system.language === migrationItem.system.language
            );

            if (variant) {
                variantStates.push({
                    itemCodename: migrationItem.system.codename,
                    languageCodename: migrationItem.system.language,
                    languageVariant: variant.languageVariant,
                    state: 'exists'
                });
            } else {
                variantStates.push({
                    itemCodename: migrationItem.system.codename,
                    languageCodename: migrationItem.system.language,
                    languageVariant: undefined,
                    state: 'doesNotExists'
                });
            }
        }

        return variantStates;
    }

    private async getItemStatesAsync(itemCodenames: string[]): Promise<IItemStateInTargetEnvironmentByCodename[]> {
        const items = await this.getContentItemsByCodenamesAsync(itemCodenames);
        const itemStates: IItemStateInTargetEnvironmentByCodename[] = [];

        for (const codename of itemCodenames) {
            const item = items.find((m) => m.codename === codename);
            const externalId = getItemExternalIdForCodename(codename);

            if (item) {
                itemStates.push({
                    itemCodename: codename,
                    item: item,
                    state: 'exists',
                    externalIdToUse: externalId
                });
            } else {
                itemStates.push({
                    itemCodename: codename,
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

        for (const assetCodename of assetCodenames) {
            const asset = assets.find((m) => m.codename === assetCodename);
            const externalId = getAssetExternalIdForCodename(assetCodename);

            if (asset) {
                assetStates.push({
                    assetCodename: assetCodename,
                    asset: asset,
                    state: 'exists',
                    externalIdToUse: externalId
                });
            } else {
                assetStates.push({
                    assetCodename: assetCodename,
                    asset: undefined,
                    state: 'doesNotExists',
                    externalIdToUse: externalId
                });
            }
        }

        return assetStates;
    }
}
