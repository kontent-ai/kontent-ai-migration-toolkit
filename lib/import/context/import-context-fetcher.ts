import { AssetModels, ContentItemModels, LanguageVariantModels } from '@kontent-ai/management-sdk';
import chalk from 'chalk';
import { match } from 'ts-pattern';
import {
    AssetStateInTargetEnvironmentByCodename,
    ItemStateInTargetEnvironmentByCodename,
    LanguageVariantSchedulesStateValues,
    LanguageVariantStateData,
    LanguageVariantStateInTargetEnvironmentByCodename,
    LanguageVariantWorkflowState,
    LanguageVariantWorkflowStateValues,
    LogSpinnerData,
    MigrationItem,
    WorkflowStep,
    findRequired,
    is404Error,
    isNotUndefined,
    managementClientUtils,
    processItemsAsync,
    runMapiRequestAsync,
    workflowHelper as workflowHelperInit
} from '../../core/index.js';
import { ExtractItemByCodename, itemsExtractionProcessor } from '../../translation/index.js';
import { GetFlattenedElementByCodenames, ImportContext, ImportContextConfig, ImportContextEnvironmentData } from '../import.models.js';

interface LanguageVariantWrapper {
    readonly draftLanguageVariant: Readonly<LanguageVariantModels.ContentItemLanguageVariant> | undefined;
    readonly publishedLanguageVariant: Readonly<LanguageVariantModels.ContentItemLanguageVariant> | undefined;
    readonly migrationItem: MigrationItem;
}

export async function importContextFetcherAsync(config: ImportContextConfig) {
    const getEnvironmentDataAsync = async (): Promise<ImportContextEnvironmentData> => {
        const mapiUtils = managementClientUtils(config.managementClient, config.logger);

        return await config.logger.logWithSpinnerAsync(async (spinnerData) => {
            spinnerData({ type: 'info', message: `Loading environment data` });

            const environmentData: ImportContextEnvironmentData = {
                collections: await mapiUtils.getAllCollectionsAsync(spinnerData),
                languages: await mapiUtils.getAllLanguagesAsync(spinnerData),
                workflows: await mapiUtils.getAllWorkflowsAsync(spinnerData),
                types: await mapiUtils.getFlattenedContentTypesAsync(spinnerData),
                assetFolders: await mapiUtils.getAllAssetFoldersAsync(spinnerData)
            };

            spinnerData({ type: 'info', message: `Environmental data loaded` });

            return environmentData;
        });
    };

    const environmentData = await getEnvironmentDataAsync();
    const workflowHelper = workflowHelperInit(environmentData.workflows);

    const getElement = () => {
        const getFlattenedElement: GetFlattenedElementByCodenames = (contentTypeCodename, elementCodename, sourceType) => {
            const contentType = findRequired(
                environmentData.types,
                (type) => type.contentTypeCodename === contentTypeCodename,
                `Content type with codename '${chalk.red(contentTypeCodename)}' was not found.`
            );

            const element = findRequired(
                contentType.elements,
                (element) => element.codename === elementCodename,
                `Element type with codename '${chalk.red(elementCodename)}' was not found in content type '${chalk.red(
                    contentTypeCodename
                )}'. Available elements are '${contentType.elements.map((element) => chalk.yellow(element.codename)).join(', ')}'`
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

    const getLatestLanguageVariantAsync = async (
        logSpinner: LogSpinnerData,
        migrationItem: MigrationItem
    ): Promise<Readonly<LanguageVariantModels.ContentItemLanguageVariant> | undefined> => {
        try {
            const latestLanguageVariant = await runMapiRequestAsync({
                logger: config.logger,
                func: async () =>
                    (
                        await config.managementClient
                            .viewLanguageVariant()
                            .byItemCodename(migrationItem.system.codename)
                            .byLanguageCodename(migrationItem.system.language.codename)
                            .toPromise()
                    ).data,
                action: 'view',
                type: 'languageVariant',
                logSpinner: logSpinner,
                itemName: `latest -> codename -> ${migrationItem.system.codename} (${migrationItem.system.language.codename})`
            });

            return latestLanguageVariant;
        } catch (error) {
            if (!is404Error(error)) {
                throw error;
            }

            return undefined;
        }
    };

    const getPublishedLanguageVariantAsync = async (
        logSpinner: LogSpinnerData,
        migrationItem: MigrationItem
    ): Promise<Readonly<LanguageVariantModels.ContentItemLanguageVariant> | undefined> => {
        try {
            const draftLanguageVariant = await runMapiRequestAsync({
                logger: config.logger,
                func: async () =>
                    (
                        await config.managementClient
                            .viewLanguageVariant()
                            .byItemCodename(migrationItem.system.codename)
                            .byLanguageCodename(migrationItem.system.language.codename)
                            .published()
                            .toPromise()
                    ).data,
                action: 'view',
                type: 'languageVariant',
                logSpinner: logSpinner,
                itemName: `published -> codename -> ${migrationItem.system.codename} (${migrationItem.system.language.codename})`
            });

            return draftLanguageVariant;
        } catch (error) {
            if (!is404Error(error)) {
                throw error;
            }

            return undefined;
        }
    };

    const getLanguageVariantWrappersAsync = async (
        migrationItems: readonly MigrationItem[]
    ): Promise<readonly LanguageVariantWrapper[]> => {
        return (
            await processItemsAsync<MigrationItem, LanguageVariantWrapper>({
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
                    const latestLanguageVariant = await getLatestLanguageVariantAsync(logSpinner, item);

                    if (!latestLanguageVariant) {
                        // there is neither published or draft version as latest version does not exist at all
                        return '404';
                    }

                    if (workflowHelper.isPublishedStepById(latestLanguageVariant.workflow.stepIdentifier.id ?? '')) {
                        // if latest version is published, it means that there is no draft, but there is published version
                        return {
                            migrationItem: item,
                            draftLanguageVariant: undefined,
                            publishedLanguageVariant: latestLanguageVariant
                        };
                    }

                    // if latest version is a draft version,  check if there is published version as well
                    return {
                        migrationItem: item,
                        draftLanguageVariant: latestLanguageVariant,
                        publishedLanguageVariant: await getPublishedLanguageVariantAsync(logSpinner, item)
                    };
                }
            })
        )
            .map((m) => m.outputItem)
            .filter(isNotUndefined);
    };

    const getContentItemsByCodenamesAsync = async (
        itemCodenames: ReadonlySet<string>
    ): Promise<readonly ContentItemModels.ContentItem[]> => {
        return (
            await processItemsAsync<string, Readonly<ContentItemModels.ContentItem>>({
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
                            func: async () => (await config.managementClient.viewContentItem().byItemCodename(codename).toPromise()).data,
                            action: 'view',
                            type: 'contentItem',
                            logSpinner: logSpinner,
                            itemName: `codename -> ${codename}`
                        });
                    } catch (error) {
                        if (!is404Error(error)) {
                            throw error;
                        }

                        return '404';
                    }
                }
            })
        )
            .map((m) => m.outputItem)
            .filter(isNotUndefined);
    };

    const getAssetsByCodenamesAsync = async (assetCodenames: ReadonlySet<string>): Promise<readonly AssetModels.Asset[]> => {
        return (
            await processItemsAsync<string, Readonly<AssetModels.Asset>>({
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
                            func: async () => (await config.managementClient.viewAsset().byAssetCodename(codename).toPromise()).data,
                            action: 'view',
                            type: 'asset',
                            logSpinner: logSpinner,
                            itemName: `codename -> ${codename}`
                        });
                    } catch (error) {
                        if (!is404Error(error)) {
                            throw error;
                        }

                        return '404';
                    }
                }
            })
        )
            .map((m) => m.outputItem)
            .filter(isNotUndefined);
    };

    const getVariantState = (languageVariant: Readonly<LanguageVariantModels.ContentItemLanguageVariant>): LanguageVariantStateData => {
        const variantWorkflowId = languageVariant.workflow.workflowIdentifier.id;
        const variantStepId = languageVariant.workflow.stepIdentifier.id;
        const { workflow, step } = workflowHelper.getWorkflowAndStep({
            workflowMatcher: {
                errorMessage: `Could not workflow with id '${chalk.red(variantWorkflowId)}' in target project`,
                match: (workflow) => workflow.id == variantWorkflowId
            },
            stepMatcher: {
                errorMessage: `Could not workflow step with id '${chalk.red(variantStepId)}' in workflow '${chalk.yellow(
                    variantWorkflowId
                )}'`,
                match: (step) => step.id == variantStepId
            }
        });

        return {
            languageVariant: languageVariant,
            workflow: workflow,
            workflowState: getWorkflowState(step, languageVariant)
        };
    };

    const getVariantStatesAsync = async (
        migrationItems: readonly MigrationItem[]
    ): Promise<readonly LanguageVariantStateInTargetEnvironmentByCodename[]> => {
        const variantWrappers = await getLanguageVariantWrappersAsync(migrationItems);

        return migrationItems.map<LanguageVariantStateInTargetEnvironmentByCodename>((migrationItem) => {
            const variantWrapper = variantWrappers.find(
                (m) =>
                    m.migrationItem.system.codename === migrationItem.system.codename &&
                    m.migrationItem.system.language === migrationItem.system.language
            );

            return {
                itemCodename: migrationItem.system.codename,
                languageCodename: migrationItem.system.language.codename,
                draftLanguageVariant: variantWrapper?.draftLanguageVariant
                    ? getVariantState(variantWrapper.draftLanguageVariant)
                    : undefined,
                publishedLanguageVariant: variantWrapper?.publishedLanguageVariant
                    ? getVariantState(variantWrapper.publishedLanguageVariant)
                    : undefined,
                state: variantWrapper ? 'exists' : 'doesNotExists'
            };
        });
    };

    const getWorkflowState = (
        step: Readonly<WorkflowStep>,
        variant: Readonly<LanguageVariantModels.ContentItemLanguageVariant> | undefined
    ): LanguageVariantWorkflowState => {
        if (!variant) {
            return undefined;
        }

        const getScheduledState = (): LanguageVariantSchedulesStateValues => {
            return match(variant.schedule)
                .returnType<LanguageVariantSchedulesStateValues>()
                .when(
                    (schedule) => schedule.publishTime && schedule.publishDisplayTimezone,
                    () => 'scheduledPublish'
                )
                .when(
                    (schedule) => schedule.unpublishTime && schedule.unpublishDisplayTimezone,
                    () => 'scheduledUnpublish'
                )
                .otherwise(() => 'n/a');
        };

        const getWorkflowState = (): LanguageVariantWorkflowStateValues => {
            return match(step.codename)
                .returnType<LanguageVariantWorkflowStateValues>()
                .when(
                    (stepCodename) => workflowHelper.isPublishedStepByCodename(stepCodename),
                    () => 'published'
                )
                .when(
                    (stepCodename) => workflowHelper.isArchivedStepByCodename(stepCodename),
                    () => 'archived'
                )
                .otherwise(() => 'draft');
        };

        return {
            workflowState: getWorkflowState(),
            scheduledState: getScheduledState()
        };
    };

    const getItemStatesAsync = async (itemCodenames: ReadonlySet<string>): Promise<readonly ItemStateInTargetEnvironmentByCodename[]> => {
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
        const getElementByCodenames: GetFlattenedElementByCodenames = getElement();

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
        // fetch all items, including referenced items in content
        const itemCodenamesToCheckInTargetEnv: ReadonlySet<string> = new Set<string>([
            ...referencedData.itemCodenames,
            ...config.migrationData.items.map((m) => m.system.codename)
        ]);

        // fetch all assets, including referenced assets in content
        const assetCodenamesToCheckInTargetEnv: ReadonlySet<string> = new Set<string>([
            ...referencedData.assetCodenames,
            ...config.migrationData.assets.map((m) => m.codename)
        ]);

        // prepare state of objects in target environment
        const itemStates: readonly ItemStateInTargetEnvironmentByCodename[] = await getItemStatesAsync(itemCodenamesToCheckInTargetEnv);

        const variantStates: readonly LanguageVariantStateInTargetEnvironmentByCodename[] = await getVariantStatesAsync(
            config.migrationData.items
        );

        const assetStates: readonly AssetStateInTargetEnvironmentByCodename[] = await getAssetStatesAsync(assetCodenamesToCheckInTargetEnv);

        return {
            environmentData,
            referencedData,
            categorizedImportData: {
                assets: config.migrationData.assets,
                contentItems: config.migrationData.items
            },
            getItemStateInTargetEnvironment: (itemCodename) => {
                return findRequired(
                    itemStates,
                    (state) => state.itemCodename === itemCodename,
                    `Invalid state for item '${chalk.red(itemCodename)}'. It is expected that all item states will be initialized`
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
                    `Invalid state for asset '${chalk.red(assetCodename)}'. It is expected that all asset states will be initialized`
                );
            },
            getElement: getElementByCodenames
        };
    };

    return {
        getImportContextAsync
    };
}
