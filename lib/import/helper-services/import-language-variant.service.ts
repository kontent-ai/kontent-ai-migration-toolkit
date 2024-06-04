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
    runMapiRequestAsync
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
                        migrationItem: importContentItem,
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
        migrationItem: IMigrationItem;
        preparedContentItem: ContentItemModels.ContentItem;
        managementClient: ManagementClient;
        importContentItems: IMigrationItem[];
        workflows: WorkflowModels.Workflow[];
        importContext: IImportContext;
    }): Promise<void> {
        await this.prepareLanguageVariantForImportAsync({
            migrationItem: data.migrationItem,
            workflows: data.workflows,
            importContext: data.importContext,
            managementClient: data.managementClient
        });

        const workflowStepCodename = data.migrationItem.system.workflow_step;
        const workflowCodename = data.migrationItem.system.workflow;

        if (!workflowCodename) {
            throw Error(
                `Content item '${chalk.red(data.migrationItem.system.codename)}' does not have a workflow assigned`
            );
        }

        if (!workflowStepCodename) {
            throw Error(
                `Content item '${chalk.red(data.migrationItem.system.codename)}' does not have a workflow step assigned`
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

        for (const element of data.migrationItem.elements) {
            mappedElements.push(
                await this.getElementContractAsync(data.importContentItems, element, data.importContext)
            );
        }

        // upsert language variant
        await runMapiRequestAsync({
            log: this.config.log,
            func: async () =>
                (
                    await data.managementClient
                        .upsertLanguageVariant()
                        .byItemCodename(data.preparedContentItem.codename)
                        .byLanguageCodename(data.migrationItem.system.language)
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
                ).data,
            action: 'upsert',
            type: 'languageVariant',
            useSpinner: true,
            itemName: `${data.migrationItem.system.codename} (${data.migrationItem.system.language})`
        });

        // set workflow of language variant
        await this.importWorkflowService.setWorkflowOfLanguageVariantAsync(
            data.managementClient,
            workflowCodename,
            workflowStepCodename,
            data.migrationItem,
            data.workflows
        );
    }

    private async prepareLanguageVariantForImportAsync(data: {
        migrationItem: IMigrationItem;
        managementClient: ManagementClient;
        workflows: WorkflowModels.Workflow[];
        importContext: IImportContext;
    }): Promise<void> {
        const languageVariantState = data.importContext.getLanguageVariantStateInTargetEnvironment(
            data.migrationItem.system.codename,
            data.migrationItem.system.language
        );

        const workflowCodename = data.migrationItem.system.workflow;
        const workflowStepCodename = data.migrationItem.system.workflow_step;
        const languageVariant = languageVariantState.languageVariant;

        if (!languageVariant) {
            // language variant does not exist, no need to process it any further as it will get upserted
            return;
        }

        if (!workflowCodename) {
            throw Error(
                `Item with codename '${data.migrationItem.system.codename}' does not have workflow property assigned`
            );
        }

        if (!workflowStepCodename) {
            throw Error(
                `Item with codename '${data.migrationItem.system.codename}' does not have workflow step assigned`
            );
        }

        const { workflow } = this.importWorkflowService.getWorkflowAndStep({
            workflows: data.workflows,
            workflowCodename: workflowCodename,
            workflowStepCodename: workflowStepCodename
        });

        // check if variant is published or archived
        if (this.isLanguageVariantPublished(languageVariant, data.workflows)) {
            // create new version
            await runMapiRequestAsync({
                log: this.config.log,
                func: async () =>
                    (
                        await data.managementClient
                            .createNewVersionOfLanguageVariant()
                            .byItemCodename(data.migrationItem.system.codename)
                            .byLanguageCodename(data.migrationItem.system.language)
                            .toPromise()
                    ).data,
                action: 'createNewVersion',
                type: 'languageVariant',
                useSpinner: true,
                itemName: `${data.migrationItem.system.codename} (${data.migrationItem.system.language})`
            });
        } else if (this.isLanguageVariantArchived(languageVariant, data.workflows)) {
            // change workflow step to draft
            const firstWorkflowStep = workflow.steps?.[0];

            if (firstWorkflowStep) {
                await runMapiRequestAsync({
                    log: this.config.log,
                    func: async () =>
                        (
                            await data.managementClient
                                .changeWorkflowStepOfLanguageVariant()
                                .byItemCodename(data.migrationItem.system.codename)
                                .byLanguageCodename(data.migrationItem.system.language)
                                .byWorkflowStepCodename(firstWorkflowStep.codename)
                                .toPromise()
                        ).data,
                    action: 'changeWorkflowStep',
                    type: 'languageVariant',
                    useSpinner: true,
                    itemName: `${data.migrationItem.system.codename} (${data.migrationItem.system.language}) -> ${firstWorkflowStep.codename}`
                });
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
