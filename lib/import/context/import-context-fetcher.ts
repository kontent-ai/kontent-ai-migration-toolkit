import { AssetModels, ContentItemModels, LanguageVariantModels } from '@kontent-ai/management-sdk';
import {
    AssetStateInTargetEnvironmentByCodename,
    FlattenedContentType,
    ItemStateInTargetEnvironmentByCodename,
    LanguageVariantStateInTargetEnvironmentByCodename,
    MigrationItem,
    getFlattenedContentTypesAsync,
    is404Error,
    processInChunksAsync,
    runMapiRequestAsync,
    uniqueStringFilter
} from '../../core/index.js';
import { GetFlattenedElement, ImportContext, ImportContextConfig } from '../import.models.js';
import { itemsExtractionProcessor } from '../../translation/index.js';

interface LanguageVariantWrapper {
    readonly languageVariant: LanguageVariantModels.ContentItemLanguageVariant;
    readonly migrationItem: MigrationItem;
}

export function importContextFetcher(config: ImportContextConfig) {
    const getElementFuncAsync = async () => {
        // get & flatten content type and its elements
        const flattenedTypes: FlattenedContentType[] = await getFlattenedContentTypesAsync(
            config.managementClient,
            config.logger
        );

        const getFlattenedElement: GetFlattenedElement = (contentTypeCodename, elementCodename) => {
            const contentType = flattenedTypes.find(
                (m) => m.contentTypeCodename.toLowerCase() === contentTypeCodename.toLowerCase()
            );

            if (!contentType) {
                throw Error(`Content type with codename '${contentType}' was not found.`);
            }

            const element = contentType.elements.find(
                (m) => m.codename.toLowerCase() === elementCodename.toLowerCase()
            );

            if (!element) {
                throw Error(
                    `Element type with codename '${elementCodename}' was not found in content type '${contentTypeCodename}'.`
                );
            }

            return element;
        };

        return getFlattenedElement;
    };

    const getLanguageVariantsAsync = async (migrationItems: MigrationItem[]) => {
        const languageVariants: LanguageVariantWrapper[] = [];

        await processInChunksAsync<MigrationItem, void>({
            logger: config.logger,
            chunkSize: 1,
            items: migrationItems,
            itemInfo: (item) => {
                return {
                    itemType: 'languageVariant',
                    title: `${item.system.codename} (${item.system.language.codename})`
                };
            },
            processAsync: async (item, logSpinner) => {
                try {
                    const variant = await runMapiRequestAsync({
                        logger: config.logger,
                        func: async () =>
                            (
                                await config.managementClient
                                    .viewLanguageVariant()
                                    .byItemCodename(item.system.codename)
                                    .byLanguageCodename(item.system.language.codename)
                                    .toPromise()
                            ).data,
                        action: 'view',
                        type: 'languageVariant',
                        logSpinner: logSpinner,
                        itemName: `codename -> ${item.system.codename} (${item.system.language.codename})`
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
    };

    const getContentItemsByCodenamesAsync = async (itemCodenames: string[]) => {
        const contentItems: ContentItemModels.ContentItem[] = [];

        await processInChunksAsync<string, void>({
            logger: config.logger,
            chunkSize: 1,
            items: itemCodenames,
            itemInfo: (codename) => {
                return {
                    itemType: 'contentItem',
                    title: codename
                };
            },
            processAsync: async (codename, logSpinner) => {
                try {
                    const contentItem = await runMapiRequestAsync({
                        logger: config.logger,
                        func: async () =>
                            (
                                await config.managementClient.viewContentItem().byItemCodename(codename).toPromise()
                            ).data,
                        action: 'view',
                        type: 'contentItem',
                        logSpinner: logSpinner,
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
    };

    const getAssetsByCodenamesAsync = async (assetCodenames: string[]) => {
        const assets: AssetModels.Asset[] = [];

        await processInChunksAsync<string, void>({
            logger: config.logger,
            chunkSize: 1,
            items: assetCodenames,
            itemInfo: (codename) => {
                return {
                    itemType: 'asset',
                    title: codename
                };
            },
            processAsync: async (codename, logSpinner) => {
                try {
                    const asset = await runMapiRequestAsync({
                        logger: config.logger,
                        func: async () =>
                            (
                                await config.managementClient.viewAsset().byAssetCodename(codename).toPromise()
                            ).data,
                        action: 'view',
                        type: 'asset',
                        logSpinner: logSpinner,
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
    };

    const getVariantStatesAsync = async (migrationItems: MigrationItem[]) => {
        const variants = await getLanguageVariantsAsync(migrationItems);
        const variantStates: LanguageVariantStateInTargetEnvironmentByCodename[] = [];

        for (const migrationItem of migrationItems) {
            const variant = variants.find(
                (m) =>
                    m.migrationItem.system.codename === migrationItem.system.codename &&
                    m.migrationItem.system.language === migrationItem.system.language
            );

            variantStates.push({
                itemCodename: migrationItem.system.codename,
                languageCodename: migrationItem.system.language.codename,
                languageVariant: variant?.languageVariant,
                state: variant ? 'exists' : 'doesNotExists'
            });
        }

        return variantStates;
    };

    const getItemStatesAsync = async (itemCodenames: string[]) => {
        const items = await getContentItemsByCodenamesAsync(itemCodenames);
        const itemStates: ItemStateInTargetEnvironmentByCodename[] = [];

        for (const codename of itemCodenames) {
            const item = items.find((m) => m.codename === codename);
            const externalId = config.externalIdGenerator.contentItemExternalId(codename);

            itemStates.push({
                itemCodename: codename,
                item: item,
                state: item ? 'exists' : 'doesNotExists',
                externalIdToUse: externalId
            });
        }

        return itemStates;
    };

    const getAssetStatesAsync = async (assetCodenames: string[]) => {
        const assets = await getAssetsByCodenamesAsync(assetCodenames);
        const assetStates: AssetStateInTargetEnvironmentByCodename[] = [];

        for (const assetCodename of assetCodenames) {
            const asset = assets.find((m) => m.codename === assetCodename);
            const externalId = config.externalIdGenerator.assetExternalId(assetCodename);

            assetStates.push({
                assetCodename: assetCodename,
                asset: asset,
                state: asset ? 'exists' : 'doesNotExists',
                externalIdToUse: externalId
            });
        }

        return assetStates;
    };

    const getImportContextAsync = async () => {
        const getElement: GetFlattenedElement = await getElementFuncAsync();

        const referencedData = itemsExtractionProcessor().extractReferencedItemsFromMigrationItems(
            config.importData.items,
            getElement
        );

        // only items with workflow / step are standalone content items
        const contentItemsExcludingComponents = config.importData.items.filter(
            (m) => m.system.workflow && m.system.workflow_step
        );

        // if content item does not have a workflow / step it means it is used as a component within Rich text element
        const contentItemComponents = config.importData.items.filter(
            (m) => !m.system.workflow || m.system.workflow_step
        );

        // check all items, including referenced items in content
        const itemCodenamesToCheckInTargetEnv: string[] = [
            ...referencedData.itemCodenames,
            ...contentItemsExcludingComponents.map((m) => m.system.codename)
        ].filter(uniqueStringFilter);

        // only load language variants for items to migrate, no need to get it for referenced items
        const languageVariantToCheckInTargetEnv: MigrationItem[] = contentItemsExcludingComponents;

        // check all assets, including referenced assets in content
        const assetCodenamesToCheckInTargetEnv: string[] = [
            ...referencedData.assetCodenames,
            ...config.importData.assets.map((m) => m.codename).filter(uniqueStringFilter)
        ];

        // prepare state of objects in target environment
        const itemStates: ItemStateInTargetEnvironmentByCodename[] = await getItemStatesAsync(
            itemCodenamesToCheckInTargetEnv
        );

        const variantStates: LanguageVariantStateInTargetEnvironmentByCodename[] = await getVariantStatesAsync(
            languageVariantToCheckInTargetEnv
        );

        const assetStates: AssetStateInTargetEnvironmentByCodename[] = await getAssetStatesAsync(
            assetCodenamesToCheckInTargetEnv
        );

        const importContext: ImportContext = {
            categorizedImportData: {
                assets: config.importData.assets,
                componentItems: contentItemComponents,
                contentItems: contentItemsExcludingComponents
            },
            referencedData: referencedData,
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
            },
            getElement: getElement
        };

        return importContext;
    };

    return {
        getImportContextAsync
    };
}
