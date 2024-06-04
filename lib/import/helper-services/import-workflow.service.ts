import { ManagementClient, SharedModels, WorkflowModels } from '@kontent-ai/management-sdk';
import { IMigrationItem, Log, logSpinner, runMapiRequestAsync } from '../../core/index.js';
import chalk from 'chalk';

interface IWorkflowStep {
    codename: string;
    id: string;
}

interface IWorkflowAndStep {
    workflow: WorkflowModels.Workflow;
    step: IWorkflowStep;
}

export function getImportWorkflowService(log: Log): ImportWorkflowService {
    return new ImportWorkflowService(log);
}

export class ImportWorkflowService {
    constructor(private readonly log: Log) {}

    getWorkflowAndStep(data: {
        workflowStepCodename: string;
        workflowCodename: string;
        workflows: WorkflowModels.Workflow[];
    }): IWorkflowAndStep {
        const workflow = data.workflows.find((m) => m.codename?.toLowerCase() === data.workflowCodename.toLowerCase());

        if (!workflow) {
            const errorMessages: string[] = [
                `Workflow with codename '${chalk.red(data.workflowCodename)}' does not exist in target project`,
                `Available workflows are (${data.workflows.length}): ${data.workflows
                    .map((m) => chalk.cyan(m.codename))
                    .join(', ')}`
            ];

            throw Error(errorMessages.join('. '));
        }

        const workflowStep = this.getWorkflowStep(workflow, data.workflowStepCodename);

        if (!workflowStep) {
            throw Error(
                `Workflow step with codename '${chalk.red(
                    data.workflowStepCodename
                )}' does not exist within worklflow '${chalk.cyan(workflow.codename)}'`
            );
        }

        return {
            step: workflowStep,
            workflow: workflow
        };
    }

    private getWorkflowStep(workflow: WorkflowModels.Workflow, stepCodename: string): IWorkflowStep | undefined {
        if (workflow.archivedStep.codename === stepCodename) {
            return {
                codename: workflow.archivedStep.codename,
                id: workflow.archivedStep.id
            };
        }
        if (workflow.publishedStep.codename === stepCodename) {
            return {
                codename: workflow.publishedStep.codename,
                id: workflow.publishedStep.id
            };
        }
        if (workflow.scheduledStep.codename === stepCodename) {
            return {
                codename: workflow.scheduledStep.codename,
                id: workflow.scheduledStep.id
            };
        }
        const step = workflow.steps.find((m) => m.codename === stepCodename);

        if (step) {
            return {
                codename: step.codename,
                id: step.id
            };
        }

        return undefined;
    }

    async setWorkflowOfLanguageVariantAsync(
        managementClient: ManagementClient,
        workflowCodename: string,
        workflowStepCodename: string,
        migrationItem: IMigrationItem,
        workflows: WorkflowModels.Workflow[]
    ): Promise<void> {
        const { workflow, step } = this.getWorkflowAndStep({
            workflows: workflows,
            workflowCodename: workflowCodename,
            workflowStepCodename: workflowStepCodename
        });

        if (this.doesWorkflowStepCodenameRepresentPublishedStep(workflowStepCodename, workflows)) {
            await runMapiRequestAsync({
                log: this.log,
                func: async () =>
                    (
                        await managementClient
                            .publishLanguageVariant()
                            .byItemCodename(migrationItem.system.codename)
                            .byLanguageCodename(migrationItem.system.language)
                            .withoutData()
                            .toPromise()
                    ).data,
                action: 'publish',
                type: 'languageVariant',
                useSpinner: true,
                itemName: `${migrationItem.system.codename} (${migrationItem.system.language})`
            });
        } else if (this.doesWorkflowStepCodenameRepresentScheduledStep(workflowStepCodename, workflows)) {
            logSpinner(
                {
                    type: 'skip',
                    message: `Skipping scheduled workflow step for item '${chalk.yellow(migrationItem.system.name)}'`
                },
                this.log
            );
        } else if (this.doesWorkflowStepCodenameRepresentArchivedStep(workflowStepCodename, workflows)) {
            // unpublish the language variant first if published
            // there is no way to determine if language variant is published via MAPI
            // so we have to always try unpublishing first and catching possible errors
            try {
                await runMapiRequestAsync({
                    log: this.log,
                    func: async () =>
                        (
                            await managementClient
                                .unpublishLanguageVariant()
                                .byItemCodename(migrationItem.system.codename)
                                .byLanguageCodename(migrationItem.system.language)
                                .withoutData()
                                .toPromise()
                        ).data,
                    action: 'unpublish',
                    type: 'languageVariant',
                    useSpinner: true,
                    itemName: `${migrationItem.system.codename} (${migrationItem.system.language})`
                });
            } catch (error) {
                if (error instanceof SharedModels.ContentManagementBaseKontentError) {
                    logSpinner(
                        {
                            type: 'unpublish',
                            message: `Unpublish failed, but this may be expected behavior as we cannot determine if there is a published version already. Error received: ${error.message}`
                        },
                        this.log
                    );
                } else {
                    throw error;
                }
            }

            await runMapiRequestAsync({
                log: this.log,
                func: async () =>
                    (
                        await managementClient
                            .changeWorkflowOfLanguageVariant()
                            .byItemCodename(migrationItem.system.codename)
                            .byLanguageCodename(migrationItem.system.language)
                            .withData({
                                step_identifier: {
                                    codename: workflow.archivedStep.codename
                                },
                                workflow_identifier: {
                                    codename: workflow.codename
                                }
                            })
                            .toPromise()
                    ).data,
                action: 'archive',
                type: 'languageVariant',
                useSpinner: true,
                itemName: `${migrationItem.system.codename} (${migrationItem.system.language}) -> ${workflow.archivedStep.codename}`
            });
        } else {
            if (workflow.codename === workflowStepCodename) {
                // item is already in the target workflow step
            } else {
                await runMapiRequestAsync({
                    log: this.log,
                    func: async () =>
                        (
                            await managementClient
                                .changeWorkflowOfLanguageVariant()
                                .byItemCodename(migrationItem.system.codename)
                                .byLanguageCodename(migrationItem.system.language)
                                .withData({
                                    step_identifier: {
                                        codename: step.codename
                                    },
                                    workflow_identifier: {
                                        codename: workflow.codename
                                    }
                                })
                                .toPromise()
                        ).data,
                    action: 'changeWorkflowStep',
                    type: 'languageVariant',
                    useSpinner: true,
                    itemName: `${migrationItem.system.codename} (${migrationItem.system.language}) -> ${step.codename}`
                });
            }
        }
    }

    private doesWorkflowStepCodenameRepresentPublishedStep(
        stepCodename: string,
        workflows: WorkflowModels.Workflow[]
    ): boolean {
        for (const workflow of workflows) {
            if (workflow.publishedStep.codename === stepCodename) {
                return true;
            }
        }

        return false;
    }

    private doesWorkflowStepCodenameRepresentArchivedStep(
        workflowStepCodename: string,
        workflows: WorkflowModels.Workflow[]
    ): boolean {
        for (const workflow of workflows) {
            if (workflow.archivedStep.codename === workflowStepCodename) {
                return true;
            }
        }

        return false;
    }

    private doesWorkflowStepCodenameRepresentScheduledStep(
        stepCodename: string,
        workflows: WorkflowModels.Workflow[]
    ): boolean {
        for (const workflow of workflows) {
            if (workflow.scheduledStep.codename === stepCodename) {
                return true;
            }
        }

        return false;
    }
}
