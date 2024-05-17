import {
    IExportContext,
    IExportContextEnvironmentData,
    IKontentAiExportRequestItem,
    IKontentAiPreparedExportItem,
    throwErrorForItemRequest
} from '../../../export.models.js';
import {
    IAssetStateInSourceEnvironmentById,
    IItemStateInSourceEnvironmentById,
    Log,
    getFlattenedContentTypesAsync,
    is404Error,
    logFetchedItems,
    processInChunksAsync,
    uniqueStringFilter
} from '../../../../core/index.js';
import {
    AssetModels,
    CollectionModels,
    ContentItemModels,
    LanguageModels,
    LanguageVariantModels,
    ManagementClient,
    TaxonomyModels,
    WorkflowModels
} from '@kontent-ai/management-sdk';
import colors from 'colors';
import { itemsExtractionHelper } from '../../../../translation/index.js';

export function getExportContextService(log: Log, managementClient: ManagementClient): ExportContextService {
    return new ExportContextService(log, managementClient);
}

export class ExportContextService {
    constructor(private readonly log: Log, private readonly managementClient: ManagementClient) {}

    async getExportContextAsync(data: { exportItems: IKontentAiExportRequestItem[] }): Promise<IExportContext> {
        const environmentData: IExportContextEnvironmentData = {
            collections: await this.getAllCollectionsAsync(),
            contentTypes: await getFlattenedContentTypesAsync(this.managementClient, this.log),
            languages: await this.getAllLanguagesAsync(),
            workflows: await this.getAllWorkflowsAsync(),
            taxonomies: await this.getAllTaxonomiesAsync()
        };

        this.log.console({
            type: 'info',
            message: `Preparing items for export`
        });
        const preparedItems = await this.prepareExportItemsAsync({
            environmentData: environmentData,
            exportItems: data.exportItems
        });

        this.log.console({
            type: 'info',
            message: `Extracting referenced items from content`
        });

        const referencedData = itemsExtractionHelper.extractReferencedDataFromExportItems(preparedItems);

        // fetch both referenced items and items that are set to be exported
        const itemIdsToCheckInTargetEnv: string[] = [
            ...referencedData.itemIds,
            ...preparedItems.map((m) => m.contentItem.id)
        ].filter(uniqueStringFilter);

        const assetIdsToCheckInTargetEnv: string[] = [...referencedData.assetIds];

        this.log.console({
            type: 'info',
            message: `Fetching referenced items`
        });
        const itemStates: IItemStateInSourceEnvironmentById[] = await this.getItemStatesAsync(
            itemIdsToCheckInTargetEnv
        );

        this.log.console({
            type: 'info',
            message: `Fetching referenced assets`
        });
        const assetStates: IAssetStateInSourceEnvironmentById[] = await this.getAssetStatesAsync(
            assetIdsToCheckInTargetEnv
        );

        return {
            preparedExportItems: preparedItems,
            environmentData: environmentData,
            referencedData: referencedData,
            getAssetStateInSourceEnvironment: (id) => {
                const assetSate = assetStates.find((m) => m.id === id);

                if (!assetSate) {
                    throw Error(`Invalid state for asset '${id}'. It is expected that all asset states will exist`);
                }

                return assetSate;
            },
            getItemStateInSourceEnvironment: (id) => {
                const itemState = itemStates.find((m) => m.id === id);

                if (!itemState) {
                    throw Error(`Invalid state for item '${id}'. It is expected that all item states will exist`);
                }

                return itemState;
            }
        };
    }

    private async prepareExportItemsAsync(data: {
        environmentData: IExportContextEnvironmentData;
        exportItems: IKontentAiExportRequestItem[];
    }): Promise<IKontentAiPreparedExportItem[]> {
        const items: IKontentAiPreparedExportItem[] = [];

        for (const exportItem of data.exportItems) {
            const contentItem = (
                await this.managementClient.viewContentItem().byItemCodename(exportItem.itemCodename).toPromise()
            ).data;

            const languageVariant = (
                await this.managementClient
                    .viewLanguageVariant()
                    .byItemCodename(exportItem.itemCodename)
                    .byLanguageCodename(exportItem.languageCodename)
                    .toPromise()
            ).data;

            const collection = data.environmentData.collections.find((m) => m.id === contentItem.collection.id);

            if (!collection) {
                throwErrorForItemRequest(
                    exportItem,
                    `Invalid collection '${colors.yellow(contentItem.collection.id ?? '')}'`
                );
            }

            const contentType = data.environmentData.contentTypes.find((m) => m.contentTypeId === contentItem.type.id);

            if (!contentType) {
                throwErrorForItemRequest(exportItem, `Invalid content type '${colors.yellow(contentItem.type.id)}'`);
            }

            const language = data.environmentData.languages.find((m) => m.id === languageVariant.language.id);

            if (!language) {
                throwErrorForItemRequest(
                    exportItem,
                    `Invalid language '${colors.yellow(languageVariant.language.id ?? '')}'`
                );
            }

            const workflow = data.environmentData.workflows.find(
                (m) => m.id === languageVariant.workflow.workflowIdentifier.id
            );

            if (!workflow) {
                throwErrorForItemRequest(
                    exportItem,
                    `Invalid workflow '${colors.yellow(languageVariant.workflow.workflowIdentifier.id ?? '')}'`
                );
            }

            const workflowStepCodename = this.getWorkflowStepCodename(workflow, languageVariant);

            if (!workflowStepCodename) {
                throwErrorForItemRequest(
                    exportItem,
                    `Invalid workflow step '${colors.yellow(languageVariant.workflow.stepIdentifier.id ?? '')}'`
                );
            }

            items.push({
                contentItem: contentItem,
                languageVariant: languageVariant,
                contentType: contentType,
                requestItem: exportItem,
                workflow: workflow,
                workflowStepCodename: workflowStepCodename,
                collection: collection,
                language: language
            });
        }

        return items;
    }

    private getWorkflowStepCodename(
        workflow: WorkflowModels.Workflow,
        languageVariant: LanguageVariantModels.ContentItemLanguageVariant
    ): string | undefined {
        const variantStepId = languageVariant.workflow.stepIdentifier.id;

        for (const step of workflow.steps) {
            if (step.id === variantStepId) {
                return step.codename;
            }
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
    }

    private async getAllLanguagesAsync(): Promise<LanguageModels.LanguageModel[]> {
        const response = await this.managementClient.listLanguages().toAllPromise();
        logFetchedItems({
            count: response.data.items.length,
            itemType: 'languages',
            log: this.log
        });
        return response.data.items;
    }

    private async getAllCollectionsAsync(): Promise<CollectionModels.Collection[]> {
        const response = await this.managementClient.listCollections().toPromise();
        logFetchedItems({
            count: response.data.collections.length,
            itemType: 'collections',
            log: this.log
        });
        return response.data.collections;
    }

    private async getAllWorkflowsAsync(): Promise<WorkflowModels.Workflow[]> {
        const response = await this.managementClient.listWorkflows().toPromise();
        logFetchedItems({
            count: response.data.length,
            itemType: 'workflows',
            log: this.log
        });
        return response.data;
    }

    private async getAllTaxonomiesAsync(): Promise<TaxonomyModels.Taxonomy[]> {
        const response = await this.managementClient.listTaxonomies().toAllPromise();
        logFetchedItems({
            count: response.data.items.length,
            itemType: 'taxonomies',
            log: this.log
        });
        return response.data.items;
    }

    private async getContentItemsByIdsAsync(itemIds: string[]): Promise<ContentItemModels.ContentItem[]> {
        const contentItems: ContentItemModels.ContentItem[] = [];

        await processInChunksAsync<string, void>({
            log: this.log,
            type: 'contentItem',
            chunkSize: 1,
            items: itemIds,
            itemInfo: (id) => {
                return {
                    itemType: 'contentItem',
                    title: id
                };
            },
            processFunc: async (id) => {
                try {
                    this.log.spinner?.text?.({
                        type: 'fetch',
                        message: `${id}`
                    });

                    const contentItem = await this.managementClient
                        .viewContentItem()
                        .byItemId(id)
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

    private async getAssetsByIdsAsync(itemIds: string[]): Promise<AssetModels.Asset[]> {
        const assets: AssetModels.Asset[] = [];

        await processInChunksAsync<string, void>({
            log: this.log,
            type: 'asset',
            chunkSize: 1,
            items: itemIds,
            itemInfo: (id) => {
                return {
                    itemType: 'asset',
                    title: id
                };
            },
            processFunc: async (id) => {
                try {
                    this.log.spinner?.text?.({
                        type: 'fetch',
                        message: `${id}`
                    });

                    const asset = await this.managementClient
                        .viewAsset()
                        .byAssetId(id)
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

    private async getItemStatesAsync(itemIds: string[]): Promise<IItemStateInSourceEnvironmentById[]> {
        const items = await this.getContentItemsByIdsAsync(itemIds);
        const itemStates: IItemStateInSourceEnvironmentById[] = [];

        for (const itemId of itemIds) {
            const item = items.find((m) => m.id === itemId);

            if (item) {
                itemStates.push({
                    id: itemId,
                    item: item,
                    state: 'exists'
                });
            } else {
                itemStates.push({
                    id: itemId,
                    item: undefined,
                    state: 'doesNotExists'
                });
            }
        }

        return itemStates;
    }

    private async getAssetStatesAsync(assetIds: string[]): Promise<IAssetStateInSourceEnvironmentById[]> {
        const assets = await this.getAssetsByIdsAsync(assetIds);
        const assetStates: IAssetStateInSourceEnvironmentById[] = [];

        for (const assetId of assetIds) {
            const asset = assets.find((m) => m.id === assetId);

            if (asset) {
                assetStates.push({
                    id: assetId,
                    asset: asset,
                    state: 'exists'
                });
            } else {
                assetStates.push({
                    id: assetId,
                    asset: undefined,
                    state: 'doesNotExists'
                });
            }
        }

        return assetStates;
    }
}
