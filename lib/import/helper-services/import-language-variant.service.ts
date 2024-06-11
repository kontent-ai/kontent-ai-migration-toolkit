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
    MigrationItem,
    MigrationElement,
    Logger,
    runMapiRequestAsync,
    LogSpinnerData
} from '../../core/index.js';
import { ImportWorkflowService, getImportWorkflowService } from './import-workflow.service.js';
import chalk from 'chalk';
import { importTransforms } from '../../translation/index.js';
import { ImportContext } from '../import.models.js';

export function getImportLanguageVariantstemService(config: {
    managementClient: ManagementClient;
    logger: Logger;
    skipFailedItems: boolean;
}): ImportLanguageVariantServices {
    return new ImportLanguageVariantServices(config);
}

export class ImportLanguageVariantServices {
    private readonly importContentItemChunkSize: number = 1;
    private readonly importWorkflowService: ImportWorkflowService;

    constructor(private readonly config: { managementClient: ManagementClient; logger: Logger; skipFailedItems: boolean }) {
        this.importWorkflowService = getImportWorkflowService(config.logger);
    }

    async importLanguageVariantsAsync(data: {
        importContentItems: MigrationItem[];
        workflows: WorkflowModels.Workflow[];
        preparedContentItems: ContentItemModels.ContentItem[];
        importContext: ImportContext;
    }): Promise<void> {
        this.config.logger.log({
            type: 'info',
            message: `Importing '${chalk.yellow(data.importContentItems.length.toString())}' language variants`
        });

        await processInChunksAsync<MigrationItem, void>({
            logger: this.config.logger,
            chunkSize: this.importContentItemChunkSize,
            items: data.importContentItems,
            itemInfo: (input) => {
                return {
                    itemType: 'languageVariant',
                    title: input.system.name,
                    partA: input.system.language
                };
            },
            processAsync: async (importContentItem, logSpinner) => {
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
                        logSpinner: logSpinner,
                        migrationItem: importContentItem,
                        preparedContentItem,
                        managementClient: this.config.managementClient,
                        importContentItems: data.importContentItems,
                        workflows: data.workflows,
                        importContext: data.importContext
                    });
                } catch (error) {
                    if (this.config.skipFailedItems) {
                        this.config.logger.log({
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
        logSpinner: LogSpinnerData;
        migrationItem: MigrationItem;
        preparedContentItem: ContentItemModels.ContentItem;
        managementClient: ManagementClient;
        importContentItems: MigrationItem[];
        workflows: WorkflowModels.Workflow[];
        importContext: ImportContext;
    }): Promise<void> {
        await this.prepareLanguageVariantForImportAsync({
            logSpinner: data.logSpinner,
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
                await this.getElementContractAsync(
                    data.migrationItem,
                    element,
                    data.importContentItems,
                    data.importContext
                )
            );
        }

        // upsert language variant
        await runMapiRequestAsync({
            logger: this.config.logger,
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
            logSpinner: data.logSpinner,
            itemName: `${data.migrationItem.system.codename} (${data.migrationItem.system.language})`
        });

        // set workflow of language variant
        await this.importWorkflowService.setWorkflowOfLanguageVariantAsync(
            data.logSpinner,
            data.managementClient,
            workflowCodename,
            workflowStepCodename,
            data.migrationItem,
            data.workflows
        );
    }

    private async prepareLanguageVariantForImportAsync(data: {
        logSpinner: LogSpinnerData | undefined;
        migrationItem: MigrationItem;
        managementClient: ManagementClient;
        workflows: WorkflowModels.Workflow[];
        importContext: ImportContext;
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
                logger: this.config.logger,
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
                logSpinner: data.logSpinner,
                itemName: `${data.migrationItem.system.codename} (${data.migrationItem.system.language})`
            });
        } else if (this.isLanguageVariantArchived(languageVariant, data.workflows)) {
            // change workflow step to draft
            const firstWorkflowStep = workflow.steps?.[0];

            if (firstWorkflowStep) {
                await runMapiRequestAsync({
                    logger: this.config.logger,
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
                    logSpinner: data.logSpinner,
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
        migrationItem: MigrationItem,
        element: MigrationElement,
        sourceItems: MigrationItem[],
        importContext: ImportContext
    ): Promise<ElementContracts.IContentItemElementContract> {
        const flattenedElement = importContext.getElement(migrationItem.system.type, element.codename);

        const importContract = await importTransforms[flattenedElement.type]({
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
