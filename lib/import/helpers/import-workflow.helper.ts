import { ManagementClient, WorkflowModels } from '@kontent-ai/management-sdk';
import { IParsedContentItem } from '../import.models.js';
import { logItemAction, logErrorAndExit, LogLevel } from '../../core/index.js';
import colors from 'colors';

export function getImportWorkflowHelper(config: { logLevel: LogLevel }): ImportWorkflowHelper {
    return new ImportWorkflowHelper(config.logLevel);
}

export class ImportWorkflowHelper {
    private readonly defaultWorkflowCodename: string = 'Default';

    constructor(private readonly logLevel: LogLevel) {}

    getWorkflowForGivenStepById(workflowId: string, workflows: WorkflowModels.Workflow[]): WorkflowModels.Workflow {
        return this.getWorkflowForGivenStep(workflows, (workflow) => {
            if (workflow.archivedStep.id === workflowId) {
                return true;
            }
            if (workflow.publishedStep.id === workflowId) {
                return true;
            }
            if (workflow.scheduledStep.id === workflowId) {
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
        // check if workflow step exists in target project
        if (!this.doesWorkflowStepExist(workflowStepCodename, workflows)) {
            logErrorAndExit({
                message: `Could not change workflow step for item '${colors.yellow(
                    importContentItem.system.codename
                )}' because step with codename '${colors.red(workflowStepCodename)}' does not exist`
            });
        }

        if (this.doesWorkflowStepCodenameRepresentPublishedStep(workflowStepCodename, workflows)) {
            logItemAction(this.logLevel, 'publish', 'languageVariant', {
                title: `${importContentItem.system.name}`,
                language: importContentItem.system.language,
                codename: importContentItem.system.codename,
                workflowStep: importContentItem.system.workflow_step
            });

            await managementClient
                .publishLanguageVariant()
                .byItemCodename(importContentItem.system.codename)
                .byLanguageCodename(importContentItem.system.language)
                .withoutData()
                .toPromise();
        } else if (this.doesWorkflowStepCodenameRepresentScheduledStep(workflowStepCodename, workflows)) {
            logItemAction(this.logLevel, 'skip', 'languageVariant', {
                title: `Skipping scheduled workflow step for item '${colors.yellow(importContentItem.system.name)}'`,
                language: importContentItem.system.language,
                codename: importContentItem.system.codename,
                workflowStep: importContentItem.system.workflow_step
            });
        } else if (this.doesWorkflowStepCodenameRepresentArchivedStep(workflowStepCodename, workflows)) {
            const workflow = this.getWorkflowForGivenStepByCodename(workflowStepCodename, workflows);

            logItemAction(this.logLevel, 'archive', 'languageVariant', {
                title: `${importContentItem.system.name}`,
                language: importContentItem.system.language,
                codename: importContentItem.system.codename,
                workflowStep: importContentItem.system.workflow_step
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
            const workflow = this.getWorkflowForGivenStepByCodename(workflowStepCodename, workflows);

            if (workflow.codename === workflowStepCodename) {
                // item is already in the target workflow step
            } else {
                logItemAction(this.logLevel, 'changeWorkflowStep', 'languageVariant', {
                    title: `${importContentItem.system.name}`,
                    language: importContentItem.system.language,
                    codename: importContentItem.system.codename,
                    workflowStep: importContentItem.system.workflow_step
                });

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

    private getWorkflowForGivenStep(
        workflows: WorkflowModels.Workflow[],
        workflowMatcher: (workflow: WorkflowModels.Workflow) => boolean
    ): WorkflowModels.Workflow {
        const matchedWorkflow = workflows.find((workflow) => workflowMatcher(workflow));

        if (matchedWorkflow) {
            return matchedWorkflow;
        }

        const defaultWorkflow = workflows.find(
            (m) => m.codename.toLowerCase() === this.defaultWorkflowCodename.toLowerCase()
        );

        if (!defaultWorkflow) {
            logErrorAndExit({
                message: `Missing default workflow`
            });
        }

        return defaultWorkflow;
    }

    private getWorkflowForGivenStepByCodename(
        stepCodename: string,
        workflows: WorkflowModels.Workflow[]
    ): WorkflowModels.Workflow {
        return this.getWorkflowForGivenStep(workflows, (workflow) => {
            if (workflow.archivedStep.codename === stepCodename) {
                return true;
            }
            if (workflow.publishedStep.codename === stepCodename) {
                return true;
            }
            if (workflow.scheduledStep.codename === stepCodename) {
                return true;
            }
            const step = workflow.steps.find((m) => m.codename === stepCodename);

            if (step) {
                return true;
            }

            return false;
        });
    }

    private doesWorkflowStepExist(stepCodename: string, workflows: WorkflowModels.Workflow[]): boolean {
        for (const workflow of workflows) {
            if (workflow.archivedStep.codename === stepCodename) {
                return true;
            }
            if (workflow.publishedStep.codename === stepCodename) {
                return true;
            }
            if (workflow.scheduledStep.codename === stepCodename) {
                return true;
            }
            const step = workflow.steps.find((m) => m.codename === stepCodename);

            if (step) {
                return true;
            }
        }

        return false;
    }
}
