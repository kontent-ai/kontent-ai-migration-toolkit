import { AssetModels, ContentItemModels, LanguageVariantModels } from '@kontent-ai/management-sdk';
import {
    AssetStateInTargetEnvironmentByCodename,
    FlattenedContentType,
    ItemStateInTargetEnvironmentByCodename,
    LanguageVariantStateInTargetEnvironmentByCodename,
    MigrationItem,
    findRequired,
    is404Error,
    isNotUndefined,
    managementClientUtils,
    processSetAsync,
    runMapiRequestAsync
} from '../../core/index.js';
import {
    GetFlattenedElementByCodenames,
    ImportContext,
    ImportContextConfig,
    ImportContextEnvironmentData
} from '../import.models.js';
import { ExtractItemByCodename, itemsExtractionProcessor } from '../../translation/index.js';
import chalk from 'chalk';

interface LanguageVariantWrapper {
    readonly languageVariant: Readonly<LanguageVariantModels.ContentItemLanguageVariant>;
    readonly migrationItem: MigrationItem;
}

export function importContextFetcher(config: ImportContextConfig) {
    const mapiUtils = managementClientUtils(config.managementClient, config.logger);

    const getElement = (types: readonly FlattenedContentType[]) => {
        const getFlattenedElement: GetFlattenedElementByCodenames = (
            contentTypeCodename,
            elementCodename,
            sourceType
        ) => {
            const contentType = findRequired(
                types,
                (type) => type.contentTypeCodename === contentTypeCodename,
                `Content type with codename '${chalk.red(contentTypeCodename)}' was not found.`
            );

            const element = findRequired(
                contentType.elements,
                (element) => element.codename === elementCodename,
                `Element type with codename '${chalk.red(elementCodename)}' was not found in content type '${chalk.red(
                    contentTypeCodename
                )}'. Available elements are '${contentType.elements
                    .map((element) => chalk.yellow(element.codename))
                    .join(', ')}'`
            );

            if (sourceType !== element.type) {
                throw Error(
                    `Element '${chalk.red(element.codename)}' in content type '${chalk.yellow(
                        contentType.contentTypeCodename
                    )}' is of type '${chalk.red(element.type)}', but source type is '${chalk.yellow(sourceType)}'.`
                );
            }

            return element;
        };

        return getFlattenedElement;
    };

    const getLanguageVariantsAsync = async (
        migrationItems: readonly MigrationItem[]
    ): Promise<readonly LanguageVariantWrapper[]> => {
        return (
            await processSetAsync<MigrationItem, LanguageVariantWrapper | undefined>({
                action: 'Fetching language variants',
                logger: config.logger,
                parallelLimit: 1,
                items: migrationItems,
                itemInfo: (item) => {
                    return {
                        itemType: 'languageVariant',
                        title: `${item.system.codename} (${item.system.language.codename})`
                    };
                },
                processAsync: async (item, logSpinner) => {
                    try {
                        const languageVariant = await runMapiRequestAsync({
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

                        return {
                            languageVariant: languageVariant,
                            migrationItem: item
                        };
                    } catch (error) {
                        if (!is404Error(error)) {
                            throw error;
                        }

                        return undefined;
                    }
                }
            })
        ).filter(isNotUndefined);
    };

    const getContentItemsByCodenamesAsync = async (
        itemCodenames: ReadonlySet<string>
    ): Promise<readonly ContentItemModels.ContentItem[]> => {
        return (
            await processSetAsync<string, ContentItemModels.ContentItem | undefined>({
                action: 'Fetching content items',
                logger: config.logger,
                parallelLimit: 1,
                items: Array.from(itemCodenames),
                itemInfo: (codename) => {
                    return {
                        itemType: 'contentItem',
                        title: codename
                    };
                },
                processAsync: async (codename, logSpinner) => {
                    try {
                        return await runMapiRequestAsync({
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
                    } catch (error) {
                        if (!is404Error(error)) {
                            throw error;
                        }

                        return undefined;
                    }
                }
            })
        ).filter(isNotUndefined);
    };

    const getAssetsByCodenamesAsync = async (
        assetCodenames: ReadonlySet<string>
    ): Promise<readonly AssetModels.Asset[]> => {
        return (
            await processSetAsync<string, AssetModels.Asset | undefined>({
                action: 'Fetching assets',
                logger: config.logger,
                parallelLimit: 1,
                items: Array.from(assetCodenames),
                itemInfo: (codename) => {
                    return {
                        itemType: 'asset',
                        title: codename
                    };
                },
                processAsync: async (codename, logSpinner) => {
                    try {
                        return await runMapiRequestAsync({
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
                    } catch (error) {
                        if (!is404Error(error)) {
                            throw error;
                        }

                        return undefined;
                    }
                }
            })
        ).filter(isNotUndefined);
    };

    const getVariantStatesAsync = async (
        migrationItems: readonly MigrationItem[]
    ): Promise<readonly LanguageVariantStateInTargetEnvironmentByCodename[]> => {
        const variants = await getLanguageVariantsAsync(migrationItems);

        return migrationItems.map<LanguageVariantStateInTargetEnvironmentByCodename>((migrationItem) => {
            const variant = variants.find(
                (m) =>
                    m.migrationItem.system.codename === migrationItem.system.codename &&
                    m.migrationItem.system.language === migrationItem.system.language
            );

            return {
                itemCodename: migrationItem.system.codename,
                languageCodename: migrationItem.system.language.codename,
                languageVariant: variant?.languageVariant,
                state: variant ? 'exists' : 'doesNotExists'
            };
        });
    };

    const getItemStatesAsync = async (
        itemCodenames: ReadonlySet<string>
    ): Promise<readonly ItemStateInTargetEnvironmentByCodename[]> => {
        const items = await getContentItemsByCodenamesAsync(itemCodenames);

        return Array.from(itemCodenames).map<ItemStateInTargetEnvironmentByCodename>((codename) => {
            const item = items.find((m) => m.codename === codename);
            return {
                itemCodename: codename,
                item: item,
                state: item ? 'exists' : 'doesNotExists',
                externalIdToUse: config.externalIdGenerator.contentItemExternalId(codename)
            };
        });
    };

    const getAssetStatesAsync = async (
        assetCodenames: ReadonlySet<string>
    ): Promise<readonly AssetStateInTargetEnvironmentByCodename[]> => {
        const assets = await getAssetsByCodenamesAsync(assetCodenames);

        return Array.from(assetCodenames).map<AssetStateInTargetEnvironmentByCodename>((codename) => {
            const asset = assets.find((m) => m.codename === codename);
            return {
                assetCodename: codename,
                asset: asset,
                state: asset ? 'exists' : 'doesNotExists',
                externalIdToUse: config.externalIdGenerator.assetExternalId(codename)
            };
        });
    };

    const getImportContextAsync = async (): Promise<ImportContext> => {
        const flattenedContentTypes: readonly FlattenedContentType[] = await mapiUtils.getFlattenedContentTypesAsync();
        const getElementByCodenames: GetFlattenedElementByCodenames = getElement(flattenedContentTypes);

        const referencedData = itemsExtractionProcessor().extractReferencedItemsFromMigrationItems(
            config.migrationData.items.reduce<ExtractItemByCodename[]>((items, item) => {
                return [
                    ...items,
                    ...item.versions.map((version) => {
                        const extractionItem: ExtractItemByCodename = {
                            contentTypeCodename: item.system.type.codename,
                            elements: version.elements
                        };
                        return extractionItem;
                    })
                ];
            }, []),
            getElementByCodenames
        );

        // if content item does not have a workflow / step it means it is used as a component within Rich text element

        // check all items, including referenced items in content
        const itemCodenamesToCheckInTargetEnv: ReadonlySet<string> = new Set<string>([
            ...referencedData.itemCodenames,
            ...config.migrationData.items.map((m) => m.system.codename)
        ]);

        // check all assets, including referenced assets in content
        const assetCodenamesToCheckInTargetEnv: ReadonlySet<string> = new Set<string>([
            ...referencedData.assetCodenames,
            ...config.migrationData.assets.map((m) => m.codename)
        ]);

        // prepare state of objects in target environment
        const itemStates: readonly ItemStateInTargetEnvironmentByCodename[] = await getItemStatesAsync(
            itemCodenamesToCheckInTargetEnv
        );

        const variantStates: readonly LanguageVariantStateInTargetEnvironmentByCodename[] = await getVariantStatesAsync(
            config.migrationData.items
        );

        const assetStates: readonly AssetStateInTargetEnvironmentByCodename[] = await getAssetStatesAsync(
            assetCodenamesToCheckInTargetEnv
        );

        const getEnvironmentDataAsync = async (): Promise<ImportContextEnvironmentData> => {
            const environmentData: ImportContextEnvironmentData = {
                collections: await mapiUtils.getAllCollectionsAsync(),
                languages: await mapiUtils.getAllLanguagesAsync(),
                workflows: await mapiUtils.getAllWorkflowsAsync()
            };

            return environmentData;
        };
        const importContext: ImportContext = {
            environmentData: await getEnvironmentDataAsync(),
            categorizedImportData: {
                assets: config.migrationData.assets,
                contentItems: config.migrationData.items
            },
            referencedData: referencedData,
            getItemStateInTargetEnvironment: (itemCodename) => {
                return findRequired(
                    itemStates,
                    (state) => state.itemCodename === itemCodename,
                    `Invalid state for item '${chalk.red(
                        itemCodename
                    )}'. It is expected that all item states will be initialized`
                );
            },
            getLanguageVariantStateInTargetEnvironment: (itemCodename, languageCodename) => {
                return findRequired(
                    variantStates,
                    (state) => state.itemCodename === itemCodename && state.languageCodename === languageCodename,
                    `Invalid state for language variant '${chalk.red(itemCodename)}' in language '${chalk.red(
                        languageCodename
                    )}'. It is expected that all variant states will be initialized`
                );
            },
            getAssetStateInTargetEnvironment: (assetCodename) => {
                return findRequired(
                    assetStates,
                    (state) => state.assetCodename === assetCodename,
                    `Invalid state for asset '${chalk.red(
                        assetCodename
                    )}'. It is expected that all asset states will be initialized`
                );
            },
            getElement: getElementByCodenames
        };

        return importContext;
    };

    return {
        getImportContextAsync
    };
}
