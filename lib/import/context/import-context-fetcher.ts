import { AssetModels, ContentItemModels, LanguageVariantModels } from '@kontent-ai/management-sdk';
import {
    AssetStateInTargetEnvironmentByCodename,
    FlattenedContentType,
    ItemStateInTargetEnvironmentByCodename,
    LanguageVariantStateInTargetEnvironmentByCodename,
    MigrationItem,
    getFlattenedContentTypesAsync,
    is404Error,
    isNotUndefined,
    processSetAsync,
    runMapiRequestAsync
} from '../../core/index.js';
import { GetFlattenedElementByCodenames, ImportContext, ImportContextConfig } from '../import.models.js';
import { itemsExtractionProcessor } from '../../translation/index.js';
import chalk from 'chalk';

interface LanguageVariantWrapper {
    readonly languageVariant: Readonly<LanguageVariantModels.ContentItemLanguageVariant>;
    readonly migrationItem: MigrationItem;
}

export function importContextFetcher(config: ImportContextConfig) {
    const getElement = (types: readonly FlattenedContentType[]) => {
        const getFlattenedElement: GetFlattenedElementByCodenames = (
            contentTypeCodename,
            elementCodename,
            sourceType
        ) => {
            const contentType = types.find(
                (m) => m.contentTypeCodename.toLowerCase() === contentTypeCodename.toLowerCase()
            );

            if (!contentType) {
                throw Error(`Content type with codename '${chalk.red(contentType)}' was not found.`);
            }

            const element = contentType.elements.find(
                (contentTypeElement) => contentTypeElement.codename.toLowerCase() === elementCodename.toLowerCase()
            );

            if (!element) {
                throw Error(
                    `Element type with codename '${chalk.red(
                        elementCodename
                    )}' was not found in content type '${chalk.red(
                        contentTypeCodename
                    )}'. Available elements are '${contentType.elements
                        .map((element) => chalk.yellow(element.codename))
                        .join(', ')}'`
                );
            }

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
            const externalId = config.externalIdGenerator.contentItemExternalId(codename);

            return {
                itemCodename: codename,
                item: item,
                state: item ? 'exists' : 'doesNotExists',
                externalIdToUse: externalId
            };
        });
    };

    const getAssetStatesAsync = async (
        assetCodenames: ReadonlySet<string>
    ): Promise<readonly AssetStateInTargetEnvironmentByCodename[]> => {
        const assets = await getAssetsByCodenamesAsync(assetCodenames);

        return Array.from(assetCodenames).map<AssetStateInTargetEnvironmentByCodename>((codename) => {
            const asset = assets.find((m) => m.codename === codename);
            const externalId = config.externalIdGenerator.assetExternalId(codename);

            return {
                assetCodename: codename,
                asset: asset,
                state: asset ? 'exists' : 'doesNotExists',
                externalIdToUse: externalId
            };
        });
    };

    const getImportContextAsync = async (): Promise<ImportContext> => {
        const flattenedContentTypes: readonly FlattenedContentType[] = await getFlattenedContentTypesAsync(
            config.managementClient,
            config.logger
        );
        const getElementByCodenames: GetFlattenedElementByCodenames = getElement(flattenedContentTypes);

        const referencedData = itemsExtractionProcessor().extractReferencedItemsFromMigrationItems(
            config.migrationData.items.map((item) => {
                return {
                    contentTypeCodename: item.system.type.codename,
                    elements: item.elements
                };
            }),
            getElementByCodenames
        );

        // only items with workflow / step are standalone content items
        const contentItemsExcludingComponents = config.migrationData.items.filter(
            (m) => m.system.workflow && m.system.workflow_step
        );

        // if content item does not have a workflow / step it means it is used as a component within Rich text element
        const contentItemComponents = config.migrationData.items.filter(
            (m) => !m.system.workflow || m.system.workflow_step
        );

        // check all items, including referenced items in content
        const itemCodenamesToCheckInTargetEnv: ReadonlySet<string> = new Set<string>([
            ...referencedData.itemCodenames,
            ...contentItemsExcludingComponents.map((m) => m.system.codename)
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
            contentItemsExcludingComponents
        );

        const assetStates: readonly AssetStateInTargetEnvironmentByCodename[] = await getAssetStatesAsync(
            assetCodenamesToCheckInTargetEnv
        );

        const importContext: ImportContext = {
            categorizedImportData: {
                assets: config.migrationData.assets,
                componentItems: contentItemComponents,
                contentItems: contentItemsExcludingComponents
            },
            referencedData: referencedData,
            getItemStateInTargetEnvironment: (itemCodename) => {
                const itemState = itemStates.find((m) => m.itemCodename === itemCodename);

                if (!itemState) {
                    throw Error(
                        `Invalid state for item '${chalk.red(
                            itemCodename
                        )}'. It is expected that all item states will be initialized`
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
                        `Invalid state for language variant '${chalk.red(itemCodename)}' in language '${chalk.red(
                            languageCodename
                        )}'. It is expected that all variant states will be initialized`
                    );
                }

                return variantState;
            },
            getAssetStateInTargetEnvironment: (assetCodename) => {
                const assetState = assetStates.find((m) => m.assetCodename === assetCodename);

                if (!assetState) {
                    throw Error(
                        `Invalid state for asset '${chalk.red(
                            assetCodename
                        )}'. It is expected that all asset states will be initialized`
                    );
                }

                return assetState;
            },
            getElement: getElementByCodenames
        };

        return importContext;
    };

    return {
        getImportContextAsync
    };
}
