import { ManagementClient, SharedModels, WorkflowModels } from '@kontent-ai/management-sdk';
import { IMigrationItem, Log } from '../../core/index.js';
import colors from 'colors';

interface IWorkflowStep {
    codename: string;
    id: string;
}

interface IWorkflowAndStep {
    workflow: WorkflowModels.Workflow;
    step: IWorkflowStep;
}

export function getImportWorkflowHelper(log?: Log): ImportWorkflowHelper {
    return new ImportWorkflowHelper(log);
}

export class ImportWorkflowHelper {
    constructor(private readonly log?: Log) {}

    getWorkflowAndStep(data: {
        workflowStepCodename: string;
        workflowCodename: string;
        workflows: WorkflowModels.Workflow[];
    }): IWorkflowAndStep {
        const workflow = data.workflows.find((m) => m.codename?.toLowerCase() === data.workflowCodename.toLowerCase());

        if (!workflow) {
            const errorMessages: string[] = [
                `Workflow with codename '${colors.red(data.workflowCodename)}' does not exist in target project`,
                `Available workflows are (${data.workflows.length}): ${data.workflows
                    .map((m) => colors.cyan(m.codename))
                    .join(', ')}`
            ];

            throw Error(errorMessages.join('. '));
        }

        const workflowStep = this.getWorkflowStep(workflow, data.workflowStepCodename);

        if (!workflowStep) {
            throw Error(
                `Workflow step with codename '${colors.red(
                    data.workflowStepCodename
                )}' does not exist within worklflow '${colors.cyan(workflow.codename)}'`
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
        importContentItem: IMigrationItem,
        workflows: WorkflowModels.Workflow[]
    ): Promise<void> {
        const { workflow, step } = this.getWorkflowAndStep({
            workflows: workflows,
            workflowCodename: workflowCodename,
            workflowStepCodename: workflowStepCodename
        });

        if (this.doesWorkflowStepCodenameRepresentPublishedStep(workflowStepCodename, workflows)) {
            this.log?.spinner?.text?.({
                type: 'publish',
                message: `${importContentItem.system.name}`
            });

            await managementClient
                .publishLanguageVariant()
                .byItemCodename(importContentItem.system.codename)
                .byLanguageCodename(importContentItem.system.language)
                .withoutData()
                .toPromise();
        } else if (this.doesWorkflowStepCodenameRepresentScheduledStep(workflowStepCodename, workflows)) {
            this.log?.spinner?.text?.({
                type: 'skip',
                message: `Skipping scheduled workflow step for item '${colors.yellow(importContentItem.system.name)}'`
            });
        } else if (this.doesWorkflowStepCodenameRepresentArchivedStep(workflowStepCodename, workflows)) {
            // unpublish the language variant first if published
            // there is no way to determine if language variant is published via MAPI
            // so we have to always try unpublishing first and catching possible errors
            try {
                this.log?.spinner?.text?.({
                    type: 'unpublish',
                    message: `${importContentItem.system.name}`
                });

                await managementClient
                    .unpublishLanguageVariant()
                    .byItemCodename(importContentItem.system.codename)
                    .byLanguageCodename(importContentItem.system.language)
                    .withoutData()
                    .toPromise();
            } catch (error) {
                if (error instanceof SharedModels.ContentManagementBaseKontentError) {
                    this.log?.spinner?.text?.({
                        type: 'unpublish',
                        message: `Unpublish failed, but this may be expected behavior as we cannot determine if there is a published version already. Error received: ${error.message}`
                    });
                } else {
                    throw error;
                }
            }

            this.log?.spinner?.text?.({
                type: 'archive',
                message: `${importContentItem.system.name}`
            });

            await managementClient
                .changeWorkflowOfLanguageVariant()
                .byItemCodename(importContentItem.system.codename)
                .byLanguageCodename(importContentItem.system.language)
                .withData({
                    step_identifier: {
                        codename: workflow.archivedStep.codename
                    },
                    workflow_identifier: {
                        codename: workflow.codename
                    }
                })
                .toPromise();
        } else {
            if (workflow.codename === workflowStepCodename) {
                // item is already in the target workflow step
            } else {
                this.log?.spinner?.text?.({
                    type: 'changeWorkflowStep',
                    message: `${importContentItem.system.name}`
                });

                await managementClient
                    .changeWorkflowOfLanguageVariant()
                    .byItemCodename(importContentItem.system.codename)
                    .byLanguageCodename(importContentItem.system.language)
                    .withData({
                        step_identifier: {
                            codename: step.codename
                        },
                        workflow_identifier: {
                            codename: workflow.codename
                        }
                    })
                    .toPromise();
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
