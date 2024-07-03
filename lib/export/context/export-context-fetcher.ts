import {
    WorkflowModels,
    LanguageVariantModels,
    ContentItemModels,
    AssetModels,
    CollectionModels,
    LanguageModels
} from '@kontent-ai/management-sdk';
import chalk from 'chalk';
import {
    processSetAsync,
    runMapiRequestAsync,
    is404Error,
    ItemStateInSourceEnvironmentById,
    AssetStateInSourceEnvironmentById,
    FlattenedContentType,
    isNotUndefined,
    managementClientUtils,
    LogSpinnerData,
    findRequired,
    workflowHelper
} from '../../core/index.js';
import { itemsExtractionProcessor } from '../../translation/index.js';
import {
    DefaultExportContextConfig,
    ExportContext,
    ExportContextEnvironmentData,
    SourceExportItem,
    ExportItem,
    GetFlattenedElementByIds,
    ExportItemVersion
} from '../export.models.js';
import { throwErrorForItemRequest } from '../utils/export.utils.js';

export async function exportContextFetcherAsync(config: DefaultExportContextConfig) {
    const getEnvironmentDataAsync = async (): Promise<ExportContextEnvironmentData> => {
        const mapiUtils = managementClientUtils(config.managementClient, config.logger);
        const environmentData: ExportContextEnvironmentData = {
            collections: await mapiUtils.getAllCollectionsAsync(),
            contentTypes: await mapiUtils.getFlattenedContentTypesAsync(),
            languages: await mapiUtils.getAllLanguagesAsync(),
            workflows: await mapiUtils.getAllWorkflowsAsync(),
            taxonomies: await mapiUtils.getAllTaxonomiesAsync()
        };

        return environmentData;
    };

    const environmentData = await getEnvironmentDataAsync();

    const getContentItemAsync = async (
        sourceItem: SourceExportItem,
        logSpinner: LogSpinnerData
    ): Promise<Readonly<ContentItemModels.ContentItem>> => {
        return await runMapiRequestAsync({
            logger: config.logger,
            logSpinner: logSpinner,
            func: async () =>
                (
                    await config.managementClient.viewContentItem().byItemCodename(sourceItem.itemCodename).toPromise()
                ).data,
            action: 'view',
            type: 'contentItem',
            itemName: `codename -> ${sourceItem.itemCodename}`
        });
    };

    const getLatestLanguageVariantAsync = async (
        sourceItem: SourceExportItem,
        logSpinner: LogSpinnerData
    ): Promise<Readonly<LanguageVariantModels.ContentItemLanguageVariant>> => {
        return await runMapiRequestAsync({
            logger: config.logger,
            logSpinner: logSpinner,
            func: async () =>
                (
                    await config.managementClient
                        .viewLanguageVariant()
                        .byItemCodename(sourceItem.itemCodename)
                        .byLanguageCodename(sourceItem.languageCodename)
                        .toPromise()
                ).data,
            action: 'view',
            type: 'languageVariant',
            itemName: `codename -> ${sourceItem.itemCodename} -> latest (${sourceItem.languageCodename})`
        });
    };

    const isLanguageVariantPublished = (
        languageVariant: Readonly<LanguageVariantModels.ContentItemLanguageVariant>
    ): boolean => {
        return environmentData.workflows.find(
            (workflow) => workflow.publishedStep.id === languageVariant.workflow.stepIdentifier.id
        )
            ? true
            : false;
    };

    const mapToExportVersionItem = (
        sourceItem: SourceExportItem,
        contentItem: Readonly<ContentItemModels.ContentItem>,
        languageVariant: Readonly<LanguageVariantModels.ContentItemLanguageVariant>
    ): ExportItemVersion => {
        return {
            languageVariant: languageVariant,
            workflowStepCodename: validateExportItem({
                sourceItem: sourceItem,
                contentItem: contentItem,
                languageVariant: languageVariant
            }).workflowStepCodename
        };
    };

    const getExportItemVersionsAsync = async (
        sourceItem: SourceExportItem,
        contentItem: Readonly<ContentItemModels.ContentItem>,
        logSpinner: LogSpinnerData
    ): Promise<readonly ExportItemVersion[]> => {
        const latestLanguageVariant = await getLatestLanguageVariantAsync(sourceItem, logSpinner);
        const latestExportVersion = mapToExportVersionItem(sourceItem, contentItem, latestLanguageVariant);

        if (isLanguageVariantPublished(latestLanguageVariant)) {
            // latest language variant is also published = no need to fetch published version
            return [latestExportVersion];
        }

        const publishedLanguageVariant = await getPublishedLanguageVariantAsync(sourceItem, logSpinner);

        if (!publishedLanguageVariant) {
            return [latestExportVersion];
        }

        return [latestExportVersion, mapToExportVersionItem(sourceItem, contentItem, publishedLanguageVariant)];
    };

    const getPublishedLanguageVariantAsync = async (
        sourceItem: SourceExportItem,
        logSpinner: LogSpinnerData
    ): Promise<Readonly<LanguageVariantModels.ContentItemLanguageVariant> | undefined> => {
        return await runMapiRequestAsync({
            logger: config.logger,
            logSpinner: logSpinner,
            func: async () => {
                try {
                    return (
                        await config.managementClient
                            .viewLanguageVariant()
                            .byItemCodename(sourceItem.itemCodename)
                            .byLanguageCodename(sourceItem.languageCodename)
                            .published()
                            .toPromise()
                    ).data;
                } catch (error) {
                    if (is404Error(error)) {
                        return undefined;
                    }
                    throw error;
                }
            },
            action: 'view',
            type: 'languageVariant',
            itemName: `codename -> ${sourceItem.itemCodename} -> published (${sourceItem.languageCodename})`
        });
    };

    const validateExportItem = (data: {
        sourceItem: SourceExportItem;
        contentItem: Readonly<ContentItemModels.ContentItem>;
        languageVariant: Readonly<LanguageVariantModels.ContentItemLanguageVariant>;
    }): {
        collection: Readonly<CollectionModels.Collection>;
        language: Readonly<LanguageModels.LanguageModel>;
        workflow: Readonly<WorkflowModels.Workflow>;
        contentType: Readonly<FlattenedContentType>;
        workflowStepCodename: string;
    } => {
        const collection = findRequired(
            environmentData.collections,
            (collection) => collection.id === data.contentItem.collection.id,
            () => {
                throwErrorForItemRequest(
                    data.sourceItem,
                    `Invalid collection '${chalk.yellow(data.contentItem.collection.id ?? '')}'`
                );
            }
        );

        const contentType = findRequired(
            environmentData.contentTypes,
            (contentType) => contentType.contentTypeId === data.contentItem.type.id,
            () => {
                throwErrorForItemRequest(
                    data.sourceItem,
                    `Invalid content type '${chalk.red(data.contentItem.type.id)}'`
                );
            }
        );

        const language = findRequired(
            environmentData.languages,
            (language) => language.id === data.languageVariant.language.id,
            () => {
                throwErrorForItemRequest(
                    data.sourceItem,
                    `Invalid language '${chalk.red(data.languageVariant.language.id ?? '')}'`
                );
            }
        );

        const workflow = findRequired(
            environmentData.workflows,
            (workflow) => workflow.id === data.languageVariant.workflow.workflowIdentifier.id,
            () => {
                throwErrorForItemRequest(
                    data.sourceItem,
                    `Invalid workflow '${chalk.red(data.languageVariant.workflow.workflowIdentifier.id ?? '')}'`
                );
            }
        );

        const workflowStep = workflowHelper(environmentData.workflows).getWorkflowStep(workflow, {
            match: (step) => step.id === data.languageVariant.workflow.stepIdentifier.id,
            errorMessage: `Invalid workflow step '${chalk.red(data.languageVariant.workflow.stepIdentifier.id ?? '')}'`
        });

        return {
            collection: collection,
            language: language,
            workflow: workflow,
            contentType: contentType,
            workflowStepCodename: workflowStep.codename
        };
    };

    const prepareExportItemsAsync = async (
        exportItems: readonly SourceExportItem[]
    ): Promise<readonly ExportItem[]> => {
        config.logger.log({
            type: 'info',
            message: `Preparing '${chalk.yellow(config.exportItems.length.toString())}' items for export`
        });

        return await processSetAsync<SourceExportItem, ExportItem>({
            logger: config.logger,
            action: 'Preparing content items & language variants',
            parallelLimit: 1,
            itemInfo: (input) => {
                return {
                    title: `${input.itemCodename} (${input.languageCodename})`,
                    itemType: 'exportedItem'
                };
            },
            items: exportItems,
            processAsync: async (sourceItem, logSpinner) => {
                const contentItem = await getContentItemAsync(sourceItem, logSpinner);
                const versions = await getExportItemVersionsAsync(sourceItem, contentItem, logSpinner);

                // get shared attributes from any version
                const anyVersion = versions[0];
                if (!anyVersion) {
                    throwErrorForItemRequest(sourceItem, `Expected at least 1 version of the content item`);
                }

                const { collection, contentType, language, workflow } = validateExportItem({
                    sourceItem: sourceItem,
                    contentItem: contentItem,
                    languageVariant: anyVersion.languageVariant
                });

                return {
                    contentItem: contentItem,
                    versions: versions,
                    contentType: contentType,
                    requestItem: sourceItem,
                    workflow: workflow,
                    collection: collection,
                    language: language
                };
            }
        });
    };

    const getContentItemsByIdsAsync = async (
        itemIds: ReadonlySet<string>
    ): Promise<readonly ContentItemModels.ContentItem[]> => {
        return (
            await processSetAsync<string, ContentItemModels.ContentItem | undefined>({
                logger: config.logger,
                action: 'Fetching content items',
                parallelLimit: 1,
                items: Array.from(itemIds),
                itemInfo: (id) => {
                    return {
                        itemType: 'contentItem',
                        title: id
                    };
                },
                processAsync: async (id, logSpinner) => {
                    try {
                        return await runMapiRequestAsync({
                            logSpinner: logSpinner,
                            logger: config.logger,
                            func: async () =>
                                (
                                    await config.managementClient.viewContentItem().byItemId(id).toPromise()
                                ).data,
                            action: 'view',
                            type: 'contentItem',
                            itemName: `id -> ${id}`
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

    const getAssetsByIdsAsync = async (itemIds: ReadonlySet<string>): Promise<readonly AssetModels.Asset[]> => {
        return (
            await processSetAsync<string, AssetModels.Asset | undefined>({
                logger: config.logger,
                action: 'Fetching assets',
                parallelLimit: 1,
                items: Array.from(itemIds),
                itemInfo: (id) => {
                    return {
                        itemType: 'asset',
                        title: id
                    };
                },
                processAsync: async (id, logSpinner) => {
                    try {
                        return await runMapiRequestAsync({
                            logger: config.logger,
                            logSpinner: logSpinner,
                            func: async () =>
                                (
                                    await config.managementClient.viewAsset().byAssetId(id).toPromise()
                                ).data,
                            action: 'view',
                            type: 'asset',
                            itemName: `id -> ${id}`
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

    const getItemStatesAsync = async (
        itemIds: ReadonlySet<string>
    ): Promise<readonly ItemStateInSourceEnvironmentById[]> => {
        const items = await getContentItemsByIdsAsync(itemIds);

        return Array.from(itemIds).map<ItemStateInSourceEnvironmentById>((itemId) => {
            const item = items.find((m) => m.id === itemId);
            return {
                id: itemId,
                item: item,
                state: item ? 'exists' : 'doesNotExists'
            };
        });
    };

    const getAssetStatesAsync = async (
        assetIds: ReadonlySet<string>
    ): Promise<readonly AssetStateInSourceEnvironmentById[]> => {
        const assets = await getAssetsByIdsAsync(assetIds);

        return Array.from(assetIds).map<AssetStateInSourceEnvironmentById>((assetId) => {
            const asset = assets.find((m) => m.id === assetId);
            return {
                id: assetId,
                asset: asset,
                state: asset ? 'exists' : 'doesNotExists'
            };
        });
    };

    const getElementByIds = (): GetFlattenedElementByIds => {
        const getFunc: GetFlattenedElementByIds = (contentTypeId: string, elementId: string) => {
            const contentType = findRequired(
                environmentData.contentTypes,
                (contentType) => contentType.contentTypeId === contentTypeId,
                `Could not find content type with id '${chalk.red(contentTypeId)}'`
            );

            const element = findRequired(
                contentType.elements,
                (element) => element.id === elementId,
                `Could not find element with id '${chalk.red(elementId)}' in content type '${chalk.red(
                    contentType.contentTypeCodename
                )}'`
            );

            return element;
        };

        return getFunc;
    };

    const getExportContextAsync = async (): Promise<ExportContext> => {
        const preparedItems = await prepareExportItemsAsync(config.exportItems);

        config.logger.log({
            type: 'info',
            message: `Extracting referenced items from content`
        });

        const referencedData = itemsExtractionProcessor().extractReferencedDataFromExtractItems(
            preparedItems.map((exportItem) => {
                return {
                    contentTypeId: exportItem.contentType.contentTypeId,
                    elements: exportItem.versions.flatMap((m) => m.languageVariant).flatMap((s) => s.elements)
                };
            }),
            getElementByIds()
        );

        // fetch both referenced items and items that are set to be exported
        const itemIdsToCheckInTargetEnv = new Set<string>([
            ...referencedData.itemIds,
            ...preparedItems.map((m) => m.contentItem.id)
        ]);

        const assetIdsToCheckInTargetEnv = new Set<string>([...referencedData.assetIds]);

        config.logger.log({
            type: 'info',
            message: `Fetching referenced items`
        });
        const itemStates: readonly ItemStateInSourceEnvironmentById[] = await getItemStatesAsync(
            itemIdsToCheckInTargetEnv
        );

        config.logger.log({
            type: 'info',
            message: `Fetching referenced assets`
        });
        const assetStates: readonly AssetStateInSourceEnvironmentById[] = await getAssetStatesAsync(
            assetIdsToCheckInTargetEnv
        );

        const exportContext: ExportContext = {
            getElement: getElementByIds(),
            exportItems: preparedItems,
            environmentData: environmentData,
            referencedData: referencedData,
            getAssetStateInSourceEnvironment: (id) =>
                findRequired(
                    assetStates,
                    (m) => m.id === id,
                    `Invalid state for asset '${chalk.red(id)}'. It is expected that all asset states will exist`
                ),
            getItemStateInSourceEnvironment: (id) =>
                findRequired(
                    itemStates,
                    (m) => m.id === id,
                    `Invalid state for item '${chalk.red(id)}'. It is expected that all item states will exist`
                )
        };

        return exportContext;
    };

    return {
        getExportContextAsync
    };
}
