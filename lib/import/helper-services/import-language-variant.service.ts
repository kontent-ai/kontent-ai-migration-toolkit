import {
    WorkflowModels,
    ContentItemModels,
    LanguageVariantModels,
    ManagementClient,
    ElementContracts,
    LanguageVariantElements
} from '@kontent-ai/management-sdk';
import {
    extractErrorData,
    logErrorAndExit,
    processInChunksAsync,
    IMigrationItem,
    IMigrationElement,
    Log,
    logSpinner
} from '../../core/index.js';
import { ImportWorkflowService, getImportWorkflowService } from './import-workflow.service.js';
import chalk from 'chalk';
import { importTransforms } from '../../translation/index.js';
import { IImportContext } from '../import.models.js';

export function getImportLanguageVariantstemService(config: {
    managementClient: ManagementClient;
    log: Log;
    skipFailedItems: boolean;
}): ImportLanguageVariantServices {
    return new ImportLanguageVariantServices(config);
}

export class ImportLanguageVariantServices {
    private readonly importContentItemChunkSize: number = 1;
    private readonly importWorkflowService: ImportWorkflowService;

    constructor(private readonly config: { managementClient: ManagementClient; log: Log; skipFailedItems: boolean }) {
        this.importWorkflowService = getImportWorkflowService(config.log);
    }

    async importLanguageVariantsAsync(data: {
        importContentItems: IMigrationItem[];
        workflows: WorkflowModels.Workflow[];
        preparedContentItems: ContentItemModels.ContentItem[];
        importContext: IImportContext;
    }): Promise<void> {
        this.config.log.logger({
            type: 'info',
            message: `Importing '${chalk.yellow(data.importContentItems.length.toString())}' language variants`
        });

        await processInChunksAsync<IMigrationItem, void>({
            log: this.config.log,
            type: 'languageVariant',
            chunkSize: this.importContentItemChunkSize,
            items: data.importContentItems,
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
                            message: `Invalid content item for codename '${chalk.red(
                                importContentItem.system.codename
                            )}'`
                        });
                    }

                    await this.importLanguageVariantAsync({
                        importContentItem,
                        preparedContentItem,
                        managementClient: this.config.managementClient,
                        importContentItems: data.importContentItems,
                        workflows: data.workflows,
                        importContext: data.importContext
                    });
                } catch (error) {
                    if (this.config.skipFailedItems) {
                        this.config.log.logger({
                            type: 'error',
                            message: `Failed to import language variant '${chalk.red(
                                importContentItem.system.name
                            )}' in language '${chalk.red(importContentItem.system.language)}'. Error: ${
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
        importContext: IImportContext;
    }): Promise<void> {
        await this.prepareLanguageVariantForImportAsync({
            importContentItem: data.importContentItem,
            workflows: data.workflows,
            importContext: data.importContext,
            managementClient: data.managementClient
        });

        const workflowStepCodename = data.importContentItem.system.workflow_step;
        const workflowCodename = data.importContentItem.system.workflow;

        if (!workflowCodename) {
            throw Error(
                `Content item '${chalk.red(data.importContentItem.system.codename)}' does not have a workflow assigned`
            );
        }

        if (!workflowStepCodename) {
            throw Error(
                `Content item '${chalk.red(
                    data.importContentItem.system.codename
                )}' does not have a workflow step assigned`
            );
        }

        // validate workflow
        const { workflow } = this.importWorkflowService.getWorkflowAndStep({
            workflowCodename: workflowCodename,
            workflowStepCodename: workflowStepCodename,
            workflows: data.workflows
        });

        // prepare & map elements
        const mappedElements: LanguageVariantElements.ILanguageVariantElementBase[] = [];

        for (const element of data.importContentItem.elements) {
            mappedElements.push(
                await this.getElementContractAsync(data.importContentItems, element, data.importContext)
            );
        }

        logSpinner(
            {
                type: 'upsert',
                message: `${data.preparedContentItem.name}`
            },
            this.config.log
        );
        await data.managementClient
            .upsertLanguageVariant()
            .byItemCodename(data.preparedContentItem.codename)
            .byLanguageCodename(data.importContentItem.system.language)
            .withData((builder) => {
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

        // set workflow of language variant
        await this.importWorkflowService.setWorkflowOfLanguageVariantAsync(
            data.managementClient,
            workflowCodename,
            workflowStepCodename,
            data.importContentItem,
            data.workflows
        );
    }

    private async prepareLanguageVariantForImportAsync(data: {
        importContentItem: IMigrationItem;
        managementClient: ManagementClient;
        workflows: WorkflowModels.Workflow[];
        importContext: IImportContext;
    }): Promise<void> {
        const languageVariantState = data.importContext.getLanguageVariantStateInTargetEnvironment(
            data.importContentItem.system.codename,
            data.importContentItem.system.language
        );

        const workflowCodename = data.importContentItem.system.workflow;
        const workflowStepCodename = data.importContentItem.system.workflow_step;
        const languageVariant = languageVariantState.languageVariant;

        if (!languageVariant) {
            // language variant does not exist, no need to process it any further as it will get upserted
            return;
        }

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

        const { workflow } = this.importWorkflowService.getWorkflowAndStep({
            workflows: data.workflows,
            workflowCodename: workflowCodename,
            workflowStepCodename: workflowStepCodename
        });

        // check if variant is published or archived
        if (this.isLanguageVariantPublished(languageVariant, data.workflows)) {
            logSpinner(
                {
                    type: 'createNewVersion',
                    message: `${data.importContentItem.system.name}`
                },
                this.config.log
            );

            // create new version
            await data.managementClient
                .createNewVersionOfLanguageVariant()
                .byItemCodename(data.importContentItem.system.codename)
                .byLanguageCodename(data.importContentItem.system.language)
                .toPromise();
        } else if (this.isLanguageVariantArchived(languageVariant, data.workflows)) {
            // change workflow step to draft
            logSpinner(
                {
                    type: 'unArchive',
                    message: `${data.importContentItem.system.name}`
                },
                this.config.log
            );

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

    private async getElementContractAsync(
        sourceItems: IMigrationItem[],
        element: IMigrationElement,
        importContext: IImportContext
    ): Promise<ElementContracts.IContentItemElementContract> {
        const importContract = await importTransforms[element.type]({
            elementCodename: element.codename,
            importContext: importContext,
            sourceItems: sourceItems,
            value: element.value
        });

        if (!importContract) {
            logErrorAndExit({
                message: `Missing import contract for element '${chalk.red(element.codename)}' `
            });
        }

        return importContract;
    }
}
