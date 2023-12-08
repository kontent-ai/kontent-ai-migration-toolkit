import {
    WorkflowModels,
    ContentItemModels,
    LanguageVariantModels,
    ManagementClient,
    ElementContracts,
    LanguageVariantElements
} from '@kontent-ai/management-sdk';
import {
    IImportedData,
    extractErrorMessage,
    is404Error,
    logItemAction,
    logDebug,
    logErrorAndExit,
    logProcessingDebug
} from '../../core/index.js';
import { IParsedContentItem, IParsedElement } from '../import.models.js';
import { importWorkflowHelper } from './import-workflow.helper.js';
import { ICategorizedParsedItems, parsedItemsHelper } from './parsed-items-helper.js';
import { translationHelper } from '../../translation/index.js';

export class ImportLanguageVariantHelper {
    async importLanguageVariantsAsync(data: {
        managementClient: ManagementClient;
        importContentItems: IParsedContentItem[];
        workflows: WorkflowModels.Workflow[];
        preparedContentItems: ContentItemModels.ContentItem[];
        importedData: IImportedData;
        config: {
            skipFailedItems: boolean;
        };
    }): Promise<void> {
        const categorizedParsedItems: ICategorizedParsedItems = parsedItemsHelper.categorizeParsedItems(
            data.importContentItems
        );

        logItemAction('skip', 'languageVariant', {
            title: `Skipping '${categorizedParsedItems.componentItems.length}' because they represent component items`
        });

        let itemIndex: number = 0;
        for (const importContentItem of categorizedParsedItems.regularItems) {
            try {
                itemIndex++;

                logProcessingDebug({
                    index: itemIndex,
                    totalCount: categorizedParsedItems.regularItems.length,
                    itemType: 'languageVariant',
                    title: `'${importContentItem.system.name}' of type '${importContentItem.system.type}' in language '${importContentItem.system.language}'`
                });

                const preparedContentItem = data.preparedContentItems.find(
                    (m) => m.codename === importContentItem.system.codename
                );

                if (!preparedContentItem) {
                    logErrorAndExit({
                        message: `Invalid content item for codename '${importContentItem.system.codename}'`
                    });
                }

                await this.importLanguageVariantAsync({
                    importContentItem,
                    preparedContentItem,
                    managementClient: data.managementClient,
                    importContentItems: data.importContentItems,
                    workflows: data.workflows,
                    importedData: data.importedData
                });
            } catch (error) {
                if (data.config.skipFailedItems) {
                    logDebug({
                        type: 'error',
                        message: `Failed to import language variant '${importContentItem.system.name}' in language '${importContentItem.system.language}'`,
                        partA: importContentItem.system.codename,
                        partB: extractErrorMessage(error)
                    });
                } else {
                    throw error;
                }
            }
        }
    }

    private async importLanguageVariantAsync(data: {
        importContentItem: IParsedContentItem;
        preparedContentItem: ContentItemModels.ContentItem;
        managementClient: ManagementClient;
        importContentItems: IParsedContentItem[];
        workflows: WorkflowModels.Workflow[];
        importedData: IImportedData;
    }): Promise<void> {
        await this.prepareLanguageVariantForImportAsync({
            importContentItem: data.importContentItem,
            managementClient: data.managementClient,
            workflows: data.workflows
        });

        const upsertedLanguageVariant = await data.managementClient
            .upsertLanguageVariant()
            .byItemCodename(data.preparedContentItem.codename)
            .byLanguageCodename(data.importContentItem.system.language)
            .withData((builder) => {
                const mappedElements: LanguageVariantElements.ILanguageVariantElementBase[] =
                    data.importContentItem.elements.map((m) =>
                        this.getElementContract(data.importContentItems, m, data.importedData)
                    );

                return {
                    elements: mappedElements
                };
            })
            .toPromise()
            .then((m) => m.data);

        data.importedData.languageVariants.push({
            original: data.importContentItem,
            imported: upsertedLanguageVariant
        });

        logItemAction('upsert', 'languageVariant', {
            title: `${data.preparedContentItem.name}`,
            language: data.importContentItem.system.language,
            codename: data.importContentItem.system.codename,
            workflowStep: data.importContentItem.system.workflow_step
        });

        // set workflow of language variant
        if (data.importContentItem.system.workflow_step) {
            await importWorkflowHelper.setWorkflowOfLanguageVariantAsync(
                data.managementClient,
                data.importContentItem.system.workflow_step,
                data.importContentItem,
                data.workflows
            );
        }
    }

    private async prepareLanguageVariantForImportAsync(data: {
        managementClient: ManagementClient;
        importContentItem: IParsedContentItem;
        workflows: WorkflowModels.Workflow[];
    }): Promise<void> {
        let languageVariantOfContentItem: undefined | LanguageVariantModels.ContentItemLanguageVariant;

        try {
            languageVariantOfContentItem = await data.managementClient
                .viewLanguageVariant()
                .byItemCodename(data.importContentItem.system.codename)
                .byLanguageCodename(data.importContentItem.system.language)
                .toPromise()
                .then((m) => m.data);

            logItemAction('fetch', 'languageVariant', {
                title: `${data.importContentItem.system.name}`,
                language: data.importContentItem.system.language,
                codename: data.importContentItem.system.codename,
                workflowStep: data.importContentItem.system.workflow_step
            });

            if (!languageVariantOfContentItem) {
                logErrorAndExit({
                    message: `Invalid langauge variant for item '${data.importContentItem.system.codename}' of type '${data.importContentItem.system.type}' and language '${data.importContentItem.system.language}'`
                });
            }
        } catch (error) {
            if (!is404Error(error)) {
                throw error;
            }
        }

        if (languageVariantOfContentItem) {
            // language variant exists
            // check if variant is published or archived
            if (this.isLanguageVariantPublished(languageVariantOfContentItem, data.workflows)) {
                // create new version
                await data.managementClient
                    .createNewVersionOfLanguageVariant()
                    .byItemCodename(data.importContentItem.system.codename)
                    .byLanguageCodename(data.importContentItem.system.language)
                    .toPromise();

                logItemAction('createNewVersion', 'languageVariant', {
                    title: `${data.importContentItem.system.name}`,
                    language: data.importContentItem.system.language,
                    codename: data.importContentItem.system.codename,
                    workflowStep: data.importContentItem.system.workflow_step
                });
            } else if (this.isLanguageVariantArchived(languageVariantOfContentItem, data.workflows)) {
                // change workflow step to draft
                if (languageVariantOfContentItem.workflow.stepIdentifier.id) {
                    const workflow = importWorkflowHelper.getWorkflowForGivenStepById(
                        languageVariantOfContentItem.workflow.stepIdentifier.id,
                        data.workflows
                    );
                    const newWorkflowStep = workflow.steps[0];

                    await data.managementClient
                        .changeWorkflowStepOfLanguageVariant()
                        .byItemCodename(data.importContentItem.system.codename)
                        .byLanguageCodename(data.importContentItem.system.language)
                        .byWorkflowStepCodename(newWorkflowStep.codename)
                        .toPromise();

                    logItemAction('unArchive', 'languageVariant', {
                        title: `${data.importContentItem.system.name}`,
                        language: data.importContentItem.system.language,
                        codename: data.importContentItem.system.codename,
                        workflowStep: data.importContentItem.system.workflow_step
                    });
                }
            }
        }
    }

    private isLanguageVariantPublished(
        languageVariant: LanguageVariantModels.ContentItemLanguageVariant,
        workflows: WorkflowModels.Workflow[]
    ): boolean {
        for (const workflow of workflows) {
            if (workflow.publishedStep.id === languageVariant.workflow.stepIdentifier.id) {
                return true;
            }
        }

        return false;
    }

    private isLanguageVariantArchived(
        languageVariant: LanguageVariantModels.ContentItemLanguageVariant,
        workflows: WorkflowModels.Workflow[]
    ): boolean {
        for (const workflow of workflows) {
            if (workflow.archivedStep.id === languageVariant.workflow.stepIdentifier.id) {
                return true;
            }
        }

        return false;
    }

    private getElementContract(
        sourceItems: IParsedContentItem[],
        element: IParsedElement,
        importedData: IImportedData
    ): ElementContracts.IContentItemElementContract {
        const importContract = translationHelper.transformToImportValue(
            element.value,
            element.codename,
            element.type,
            importedData,
            sourceItems
        );

        if (!importContract) {
            logErrorAndExit({
                message: `Missing import contract for element '${element.codename}' `
            });
        }

        return importContract;
    }
}

export const importLanguageVariantHelper = new ImportLanguageVariantHelper();
