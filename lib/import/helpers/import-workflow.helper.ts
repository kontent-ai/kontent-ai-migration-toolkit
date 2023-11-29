import { ManagementClient, WorkflowModels } from '@kontent-ai/management-sdk';
import { IParsedContentItem } from '../import.models';
import { defaultWorkflowCodename, logAction } from '../../core';

export class ImportWorkflowHelper {
    private getWorkflowForGivenStep(
        workflows: WorkflowModels.Workflow[],
        workflowMatcher: (workflow: WorkflowModels.Workflow) => boolean
    ): WorkflowModels.Workflow {
        const matchedWorkflow = workflows.find((workflow) => workflowMatcher(workflow));

        if (matchedWorkflow) {
            return matchedWorkflow;
        }

        const defaultWorkflow = workflows.find(
            (m) => m.codename.toLowerCase() === defaultWorkflowCodename.toLowerCase()
        );

        if (!defaultWorkflow) {
            throw Error(`Missing default workflow`);
        }

        return defaultWorkflow;
    }

    getWorkflowForGivenStepByCodename(
        itemWorkflowCodename: string,
        workflows: WorkflowModels.Workflow[]
    ): WorkflowModels.Workflow {
        return this.getWorkflowForGivenStep(workflows, (workflow) => {
            if (workflow.archivedStep.codename === itemWorkflowCodename) {
                return true;
            }
            if (workflow.publishedStep.codename === itemWorkflowCodename) {
                return true;
            }
            const step = workflow.steps.find((m) => m.codename === itemWorkflowCodename);

            if (step) {
                return true;
            }

            return false;
        });
    }

    getWorkflowForGivenStepById(workflowId: string, workflows: WorkflowModels.Workflow[]): WorkflowModels.Workflow {
        return this.getWorkflowForGivenStep(workflows, (workflow) => {
            if (workflow.archivedStep.id === workflowId) {
                return true;
            }
            if (workflow.publishedStep.id === workflowId) {
                return true;
            }
            const step = workflow.steps.find((m) => m.id === workflowId);

            if (step) {
                return true;
            }

            return false;
        });
    }

    async setWorkflowOfLanguageVariantAsync(
        managementClient: ManagementClient,
        workflowStepCodename: string,
        importContentItem: IParsedContentItem,
        workflows: WorkflowModels.Workflow[]
    ): Promise<void> {
        if (this.doesWorkflowStepCodenameRepresentPublishedStep(workflowStepCodename, workflows)) {
            await managementClient
                .publishLanguageVariant()
                .byItemCodename(importContentItem.system.codename)
                .byLanguageCodename(importContentItem.system.language)
                .withoutData()
                .toPromise();

            logAction('publish', 'languageVariant', {
                title: `${importContentItem.system.name}`,
                workflowStep: importContentItem.system.workflow_step,
                language: importContentItem.system.language
            });
        } else if (this.doesWorkflowStepCodenameRepresentArchivedStep(workflowStepCodename, workflows)) {
            const workflow = this.getWorkflowForGivenStepByCodename(workflowStepCodename, workflows);

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

            logAction('archive', 'languageVariant', {
                title: `${importContentItem.system.name}`,
                workflowStep: importContentItem.system.workflow_step,
                language: importContentItem.system.language
            });
        } else {
            const workflow = this.getWorkflowForGivenStepByCodename(workflowStepCodename, workflows);

            if (workflow.codename === workflowStepCodename) {
                // item is already in the target workflow step
            } else {
                await managementClient
                    .changeWorkflowOfLanguageVariant()
                    .byItemCodename(importContentItem.system.codename)
                    .byLanguageCodename(importContentItem.system.language)
                    .withData({
                        step_identifier: {
                            codename: importContentItem.system.workflow_step
                        },
                        workflow_identifier: {
                            codename: workflow.codename
                        }
                    })
                    .toPromise();

                logAction('changeWorkflowStep', 'languageVariant', {
                    title: `${importContentItem.system.name}`,
                    workflowStep: importContentItem.system.workflow_step,
                    language: importContentItem.system.language
                });
            }
        }
    }

    private doesWorkflowStepCodenameRepresentPublishedStep(
        workflowStepCodename: string,
        workflows: WorkflowModels.Workflow[]
    ): boolean {
        for (const workflow of workflows) {
            if (workflow.publishedStep.codename === workflowStepCodename) {
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
}

export const importWorkflowHelper = new ImportWorkflowHelper();
