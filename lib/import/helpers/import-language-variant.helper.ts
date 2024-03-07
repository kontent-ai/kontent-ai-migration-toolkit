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
    extractErrorData,
    is404Error,
    logErrorAndExit,
    processInChunksAsync,
    IMigrationItem,
    IMigrationElement,
    Log
} from '../../core/index.js';
import { ImportWorkflowHelper, getImportWorkflowHelper } from './import-workflow.helper.js';
import { ICategorizedParsedItems, parsedItemsHelper } from './parsed-items-helper.js';
import { getElementTranslationHelper } from '../../translation/index.js';
import colors from 'colors';

export function getImportLanguageVariantstemHelper(config: {
    log: Log;
    skipFailedItems: boolean;
}): ImportLanguageVariantHelper {
    return new ImportLanguageVariantHelper(config.log, config.skipFailedItems);
}

export class ImportLanguageVariantHelper {
    private readonly importContentItemChunkSize: number = 1;
    private readonly importWorkflowHelper: ImportWorkflowHelper;

    constructor(private readonly log: Log, private readonly skipFailedItems: boolean) {
        this.importWorkflowHelper = getImportWorkflowHelper(log);
    }

    async importLanguageVariantsAsync(data: {
        managementClient: ManagementClient;
        importContentItems: IMigrationItem[];
        workflows: WorkflowModels.Workflow[];
        preparedContentItems: ContentItemModels.ContentItem[];
        importedData: IImportedData;
    }): Promise<void> {
        const categorizedParsedItems: ICategorizedParsedItems = parsedItemsHelper.categorizeParsedItems(
            data.importContentItems
        );

        this.log.console({
            type: 'info',
            message: `Importing '${colors.yellow(
                categorizedParsedItems.regularItems.length.toString()
            )}' language variants`
        });

        await processInChunksAsync<IMigrationItem, void>({
            log: this.log,
            type: 'languageVariant',
            chunkSize: this.importContentItemChunkSize,
            items: categorizedParsedItems.regularItems,
            itemInfo: (input) => {
                return {
                    itemType: 'languageVariant',
                    title: input.system.name,
                    partA: input.system.language
                };
            },
            processFunc: async (importContentItem) => {
                try {
                    const preparedContentItem = data.preparedContentItems.find(
                        (m) => m.codename === importContentItem.system.codename
                    );

                    if (!preparedContentItem) {
                        logErrorAndExit({
                            message: `Invalid content item for codename '${colors.red(
                                importContentItem.system.codename
                            )}'`
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
                    if (this.skipFailedItems) {
                        this.log.console({
                            type: 'error',
                            message: `Failed to import language variant '${colors.red(
                                importContentItem.system.name
                            )}' in language '${colors.red(importContentItem.system.language)}'. Error: ${
                                extractErrorData(error).message
                            }`
                        });
                    } else {
                        throw error;
                    }
                }
            }
        });
    }

    private async importLanguageVariantAsync(data: {
        importContentItem: IMigrationItem;
        preparedContentItem: ContentItemModels.ContentItem;
        managementClient: ManagementClient;
        importContentItems: IMigrationItem[];
        workflows: WorkflowModels.Workflow[];
        importedData: IImportedData;
    }): Promise<void> {
        await this.prepareLanguageVariantForImportAsync({
            importContentItem: data.importContentItem,
            managementClient: data.managementClient,
            workflows: data.workflows
        });

        const workflowStepCodename = data.importContentItem.system.workflow_step;
        const workflowCodename = data.importContentItem.system.workflow;

        this.log.spinner?.text?.({
            type: 'upsert',
            message: `${data.preparedContentItem.name}`
        });

        if (!workflowCodename) {
            throw Error(
                `Content item '${colors.red(data.importContentItem.system.codename)}' does not have a workflow assigned`
            );
        }

        if (!workflowStepCodename) {
            throw Error(
                `Content item '${colors.red(
                    data.importContentItem.system.codename
                )}' does not have a workflow step assigned`
            );
        }

        // validate workflow
        const { workflow } = this.importWorkflowHelper.getWorkflowAndStep({
            workflowCodename: workflowCodename,
            workflowStepCodename: workflowStepCodename,
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
                    elements: mappedElements,
                    workflow: {
                        workflow_identifier: {
                            codename: workflow.codename
                        },
                        step_identifier: {
                            codename: workflow.steps[0].codename // use always first step
                        }
                    }
                };
            })
            .toPromise()
            .then((m) => m.data);

        data.importedData.languageVariants.push({
            original: data.importContentItem,
            imported: upsertedLanguageVariant
        });

        // set workflow of language variant
        await this.importWorkflowHelper.setWorkflowOfLanguageVariantAsync(
            data.managementClient,
            workflowCodename,
            workflowStepCodename,
            data.importContentItem,
            data.workflows
        );
    }

    private async prepareLanguageVariantForImportAsync(data: {
        managementClient: ManagementClient;
        importContentItem: IMigrationItem;
        workflows: WorkflowModels.Workflow[];
    }): Promise<void> {
        let languageVariantOfContentItem: undefined | LanguageVariantModels.ContentItemLanguageVariant;
        const workflowCodename = data.importContentItem.system.workflow;
        const workflowStepCodename = data.importContentItem.system.workflow_step;

        if (!workflowCodename) {
            throw Error(
                `Item with codename '${data.importContentItem.system.codename}' does not have workflow property assigned`
            );
        }

        if (!workflowStepCodename) {
            throw Error(
                `Item with codename '${data.importContentItem.system.codename}' does not have workflow step assigned`
            );
        }

        const { workflow } = this.importWorkflowHelper.getWorkflowAndStep({
            workflows: data.workflows,
            workflowCodename: workflowCodename,
            workflowStepCodename: workflowStepCodename
        });

        try {
            this.log.spinner?.text?.({
                type: 'fetch',
                message: `${data.importContentItem.system.name}`
            });

            languageVariantOfContentItem = await data.managementClient
                .viewLanguageVariant()
                .byItemCodename(data.importContentItem.system.codename)
                .byLanguageCodename(data.importContentItem.system.language)
                .toPromise()
                .then((m) => m.data);

            if (!languageVariantOfContentItem) {
                logErrorAndExit({
                    message: `Invalid langauge variant for item '${colors.red(
                        data.importContentItem.system.codename
                    )}' of type '${colors.yellow(data.importContentItem.system.type)}' and language '${colors.yellow(
                        data.importContentItem.system.language
                    )}'`
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
                this.log.spinner?.text?.({
                    type: 'createNewVersion',
                    message: `${data.importContentItem.system.name}`
                });

                // create new version
                await data.managementClient
                    .createNewVersionOfLanguageVariant()
                    .byItemCodename(data.importContentItem.system.codename)
                    .byLanguageCodename(data.importContentItem.system.language)
                    .toPromise();
            } else if (this.isLanguageVariantArchived(languageVariantOfContentItem, data.workflows)) {
                // change workflow step to draft
                this.log.spinner?.text?.({
                    type: 'unArchive',
                    message: `${data.importContentItem.system.name}`
                });

                const firstWorkflowStep = workflow.steps?.[0];

                if (firstWorkflowStep) {
                    await data.managementClient
                        .changeWorkflowStepOfLanguageVariant()
                        .byItemCodename(data.importContentItem.system.codename)
                        .byLanguageCodename(data.importContentItem.system.language)
                        .byWorkflowStepCodename(firstWorkflowStep.codename)
                        .toPromise();
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
        sourceItems: IMigrationItem[],
        element: IMigrationElement,
        importedData: IImportedData
    ): ElementContracts.IContentItemElementContract {
        const importContract = getElementTranslationHelper(this.log).transformToImportValue(
            element.value,
            element.codename,
            element.type,
            importedData,
            sourceItems
        );

        if (!importContract) {
            logErrorAndExit({
                message: `Missing import contract for element '${colors.red(element.codename)}' `
            });
        }

        return importContract;
    }
}
