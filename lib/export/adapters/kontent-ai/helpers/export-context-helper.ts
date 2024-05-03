import {
    IKontentAiManagementExportRequestItem,
    IKontentAiPreparedExportItem,
    throwErrorForItemRequest
} from '../../../../export/export.models.js';
import {
    IExportContext,
    IExportContextEnvironmentData,
    IItemStateInSourceEnvironmentById,
    Log,
    getFlattenedContentTypesAsync,
    is404Error,
    processInChunksAsync,
    uniqueStringFilter
} from '../../../../core/index.js';
import { ExtractionService, getExtractionService } from '../../../../extraction/extraction-service.js';
import {
    CollectionModels,
    ContentItemModels,
    LanguageModels,
    LanguageVariantModels,
    ManagementClient,
    WorkflowModels
} from '@kontent-ai/management-sdk';
import colors from 'colors';

export function getExportContextHelper(log: Log, managementClient: ManagementClient): ExportContextHelper {
    return new ExportContextHelper(log, managementClient);
}

export class ExportContextHelper {
    private readonly extractionService: ExtractionService;

    constructor(private readonly log: Log, private readonly managementClient: ManagementClient) {
        this.extractionService = getExtractionService(log);
    }

    async getExportContextAsync(data: {
        exportItems: IKontentAiManagementExportRequestItem[];
    }): Promise<IExportContext> {
        const environmentData: IExportContextEnvironmentData = {
            collections: await this.getAllCollectionsAsync(),
            contentTypes: await getFlattenedContentTypesAsync(this.managementClient, this.log),
            languages: await this.getAllLanguagesAsync(),
            workflows: await this.getAllWorkflowsAsync()
        };

        this.log.console({
            type: 'info',
            message: `Preparing items to export`
        });
        const preparedItems = await this.prepareExportItemsAsync({
            environmentData: environmentData,
            exportItems: data.exportItems
        });

        this.log.console({
            type: 'info',
            message: `Extracting referenced items`
        });
        const referencedData = this.extractionService.extractReferencedItemsFromExportItems(preparedItems);

        const itemIdsToCheckInTargetEnv: string[] = [
            ...referencedData.itemIds,
            ...preparedItems.map((m) => m.contentItem.id)
        ].filter(uniqueStringFilter);

        this.log.console({
            type: 'info',
            message: `Fetching referenced items`
        });
        const itemStates: IItemStateInSourceEnvironmentById[] = await this.getItemStatesAsync(
            itemIdsToCheckInTargetEnv
        );

        return {
            preparedExportItems: preparedItems,
            environmentData: environmentData,
            referencedData: referencedData,
            itemsInSourceEnvironment: itemStates,
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
        exportItems: IKontentAiManagementExportRequestItem[];
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
        this.log.console({ type: 'info', message: `Loading languages` });
        const response = await this.managementClient.listLanguages().toAllPromise();
        return response.data.items;
    }

    private async getAllCollectionsAsync(): Promise<CollectionModels.Collection[]> {
        this.log.console({ type: 'info', message: `Loading collections` });
        const response = await this.managementClient.listCollections().toPromise();
        return response.data.collections;
    }

    private async getAllWorkflowsAsync(): Promise<WorkflowModels.Workflow[]> {
        this.log.console({ type: 'info', message: `Loading workflows` });
        const response = await this.managementClient.listWorkflows().toPromise();
        return response.data;
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
}
