import { WorkflowModels, LanguageVariantModels, ContentItemModels, AssetModels } from '@kontent-ai/management-sdk';
import chalk from 'chalk';
import {
    processSetAsync,
    runMapiRequestAsync,
    getFlattenedContentTypesAsync,
    is404Error,
    ItemStateInSourceEnvironmentById,
    AssetStateInSourceEnvironmentById,
    uniqueStringFilter,
    FlattenedContentType,
    isNotUndefined
} from '../../core/index.js';
import { itemsExtractionProcessor } from '../../translation/index.js';
import {
    DefaultExportContextConfig,
    ExportContext,
    ExportContextEnvironmentData,
    SourceExportItem,
    ExportItem,
    GetFlattenedElementByIds
} from '../export.models.js';
import { throwErrorForItemRequest } from '../utils/export.utils.js';

export function exportContextFetcher(config: DefaultExportContextConfig) {
    const prepareExportItemsAsync = async (
        environmentData: ExportContextEnvironmentData,
        exportItems: SourceExportItem[]
    ) => {
        const items: ExportItem[] = await processSetAsync<SourceExportItem, ExportItem>({
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
            processAsync: async (exportItem, logSpinner) => {
                const contentItem = await runMapiRequestAsync({
                    logger: config.logger,
                    logSpinner: logSpinner,
                    func: async () =>
                        (
                            await config.managementClient
                                .viewContentItem()
                                .byItemCodename(exportItem.itemCodename)
                                .toPromise()
                        ).data,
                    action: 'view',
                    type: 'contentItem',
                    itemName: `codename -> ${exportItem.itemCodename} (${exportItem.languageCodename})`
                });

                const languageVariant = await runMapiRequestAsync({
                    logger: config.logger,
                    logSpinner: logSpinner,
                    func: async () =>
                        (
                            await config.managementClient
                                .viewLanguageVariant()
                                .byItemCodename(exportItem.itemCodename)
                                .byLanguageCodename(exportItem.languageCodename)
                                .toPromise()
                        ).data,
                    action: 'view',
                    type: 'languageVariant',
                    itemName: `codename -> ${exportItem.itemCodename} (${exportItem.languageCodename})`
                });

                const collection = environmentData.collections.find((m) => m.id === contentItem.collection.id);

                if (!collection) {
                    throwErrorForItemRequest(
                        exportItem,
                        `Invalid collection '${chalk.yellow(contentItem.collection.id ?? '')}'`
                    );
                }

                const contentType = environmentData.contentTypes.find((m) => m.contentTypeId === contentItem.type.id);

                if (!contentType) {
                    throwErrorForItemRequest(exportItem, `Invalid content type '${chalk.red(contentItem.type.id)}'`);
                }

                const language = environmentData.languages.find((m) => m.id === languageVariant.language.id);

                if (!language) {
                    throwErrorForItemRequest(
                        exportItem,
                        `Invalid language '${chalk.red(languageVariant.language.id ?? '')}'`
                    );
                }

                const workflow = environmentData.workflows.find(
                    (m) => m.id === languageVariant.workflow.workflowIdentifier.id
                );

                if (!workflow) {
                    throwErrorForItemRequest(
                        exportItem,
                        `Invalid workflow '${chalk.red(languageVariant.workflow.workflowIdentifier.id ?? '')}'`
                    );
                }

                const workflowStepCodename = getWorkflowStepCodename(workflow, languageVariant);

                if (!workflowStepCodename) {
                    throwErrorForItemRequest(
                        exportItem,
                        `Invalid workflow step '${chalk.red(languageVariant.workflow.stepIdentifier.id ?? '')}'`
                    );
                }

                const preparedItem: ExportItem = {
                    contentItem: contentItem,
                    languageVariant: languageVariant,
                    contentType: contentType,
                    requestItem: exportItem,
                    workflow: workflow,
                    workflowStepCodename: workflowStepCodename,
                    collection: collection,
                    language: language
                };

                return preparedItem;
            }
        });

        return items;
    };

    const getWorkflowStepCodename = (
        workflow: WorkflowModels.Workflow,
        languageVariant: LanguageVariantModels.ContentItemLanguageVariant
    ) => {
        const variantStepId = languageVariant.workflow.stepIdentifier.id;

        const workflowStep = workflow.steps.find((step) => step.id === variantStepId);

        if (workflowStep) {
            return workflowStep.id;
        }

        if (workflow.archivedStep.id === variantStepId) {
            return workflow.archivedStep.codename;
        }

        if (workflow.scheduledStep.id === variantStepId) {
            return workflow.scheduledStep.codename;
        }

        if (workflow.publishedStep.id === variantStepId) {
            return workflow.publishedStep.codename;
        }

        return undefined;
    };

    const getEnvironmentDataAsync = async () => {
        const environmentData: ExportContextEnvironmentData = {
            collections: await getAllCollectionsAsync(),
            contentTypes: await getFlattenedContentTypesAsync(config.managementClient, config.logger),
            languages: await getAllLanguagesAsync(),
            workflows: await getAllWorkflowsAsync(),
            taxonomies: await getAllTaxonomiesAsync()
        };

        return environmentData;
    };

    const getAllLanguagesAsync = async () => {
        return await runMapiRequestAsync({
            logger: config.logger,
            func: async () => (await config.managementClient.listLanguages().toAllPromise()).data.items,
            action: 'list',
            type: 'language'
        });
    };

    const getAllCollectionsAsync = async () => {
        return await runMapiRequestAsync({
            logger: config.logger,
            func: async () => (await config.managementClient.listCollections().toPromise()).data.collections,
            action: 'list',
            type: 'collection'
        });
    };

    const getAllWorkflowsAsync = async () => {
        return await runMapiRequestAsync({
            logger: config.logger,
            func: async () => (await config.managementClient.listWorkflows().toPromise()).data,
            action: 'list',
            type: 'workflow'
        });
    };

    const getAllTaxonomiesAsync = async () => {
        return await runMapiRequestAsync({
            logger: config.logger,
            func: async () => (await config.managementClient.listTaxonomies().toAllPromise()).data.items,
            action: 'list',
            type: 'taxonomy'
        });
    };

    const getContentItemsByIdsAsync = async (itemIds: string[]) => {
        return (
            await processSetAsync<string, ContentItemModels.ContentItem | undefined>({
                logger: config.logger,
                action: 'Fetching content items',
                parallelLimit: 1,
                items: itemIds,
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

    const getAssetsByIdsAsync = async (itemIds: string[]) => {
        return (
            await processSetAsync<string, AssetModels.Asset | undefined>({
                logger: config.logger,
                action: 'Fetching assets',
                parallelLimit: 1,
                items: itemIds,
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

    const getItemStatesAsync = async (itemIds: string[]) => {
        const items = await getContentItemsByIdsAsync(itemIds);

        return itemIds.map<ItemStateInSourceEnvironmentById>((itemId) => {
            const item = items.find((m) => m.id === itemId);
            return {
                id: itemId,
                item: item,
                state: item ? 'exists' : 'doesNotExists'
            };
        });
    };

    const getAssetStatesAsync = async (assetIds: string[]) => {
        const assets = await getAssetsByIdsAsync(assetIds);

        return assetIds.map<AssetStateInSourceEnvironmentById>((assetId) => {
            const asset = assets.find((m) => m.id === assetId);
            return {
                id: assetId,
                asset: asset,
                state: asset ? 'exists' : 'doesNotExists'
            };
        });
    };

    const getElementByIds = (types: FlattenedContentType[]): GetFlattenedElementByIds => {
        return (contentTypeId: string, elementId: string) => {
            const contentType = types.find((m) => m.contentTypeId === contentTypeId);

            if (!contentType) {
                throw Error(`Could not find content type with id '${chalk.red(contentTypeId)}'`);
            }

            const element = contentType.elements.find((m) => m.id === elementId);

            if (!element) {
                throw Error(
                    `Could not find element with id '${chalk.red(elementId)}' in content type '${chalk.red(
                        contentType.contentTypeCodename
                    )}'`
                );
            }

            return element;
        };
    };

    const getExportContextAsync = async () => {
        const environmentData = await getEnvironmentDataAsync();

        config.logger.log({
            type: 'info',
            message: `Preparing '${chalk.yellow(config.exportItems.length.toString())}' items for export`
        });
        const preparedItems = await prepareExportItemsAsync(environmentData, config.exportItems);

        config.logger.log({
            type: 'info',
            message: `Extracting referenced items from content`
        });

        const referencedData = itemsExtractionProcessor().extractReferencedDataFromExtractItems(
            preparedItems.map((m) => {
                return {
                    contentTypeId: m.contentType.contentTypeId,
                    elements: m.languageVariant.elements
                };
            }),
            getElementByIds(environmentData.contentTypes)
        );

        // fetch both referenced items and items that are set to be exported
        const itemIdsToCheckInTargetEnv: string[] = [
            ...referencedData.itemIds,
            ...preparedItems.map((m) => m.contentItem.id)
        ].filter(uniqueStringFilter);

        const assetIdsToCheckInTargetEnv: string[] = [...referencedData.assetIds];

        config.logger.log({
            type: 'info',
            message: `Fetching referenced items`
        });
        const itemStates: ItemStateInSourceEnvironmentById[] = await getItemStatesAsync(itemIdsToCheckInTargetEnv);

        config.logger.log({
            type: 'info',
            message: `Fetching referenced assets`
        });
        const assetStates: AssetStateInSourceEnvironmentById[] = await getAssetStatesAsync(assetIdsToCheckInTargetEnv);

        const exportContext: ExportContext = {
            getElement: getElementByIds(environmentData.contentTypes),
            exportItems: preparedItems,
            environmentData: environmentData,
            referencedData: referencedData,
            getAssetStateInSourceEnvironment: (id) => {
                const assetSate = assetStates.find((m) => m.id === id);

                if (!assetSate) {
                    throw Error(
                        `Invalid state for asset '${chalk.red(id)}'. It is expected that all asset states will exist`
                    );
                }

                return assetSate;
            },
            getItemStateInSourceEnvironment: (id) => {
                const itemState = itemStates.find((m) => m.id === id);

                if (!itemState) {
                    throw Error(
                        `Invalid state for item '${chalk.red(id)}'. It is expected that all item states will exist`
                    );
                }

                return itemState;
            }
        };

        return exportContext;
    };

    return {
        getExportContextAsync
    };
}
