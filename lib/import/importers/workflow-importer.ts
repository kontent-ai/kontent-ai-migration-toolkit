import { ManagementClient, SharedModels, WorkflowModels } from '@kontent-ai/management-sdk';
import { Logger, runMapiRequestAsync, LogSpinnerData, MigrationItem } from '../../core/index.js';
import chalk from 'chalk';

type WorkflowStep = {
    codename: string;
    id: string;
};

export function workflowImporter(config: {
    logger: Logger;
    managementClient: Readonly<ManagementClient>;
    workflows: readonly WorkflowModels.Workflow[];
}) {
    const getWorkflowStep = (
        workflow: Readonly<WorkflowModels.Workflow>,
        stepCodename: string
    ): WorkflowStep | undefined => {
        return [...workflow.steps, workflow.archivedStep, workflow.publishedStep, workflow.scheduledStep].find(
            (m) => m.codename === stepCodename
        );
    };

    const getWorkflowAndStep = (data: {
        readonly workflowStepCodename: string;
        readonly workflowCodename: string;
    }): { step: WorkflowStep; workflow: WorkflowModels.Workflow } => {
        const workflow = config.workflows.find(
            (m) => m.codename?.toLowerCase() === data.workflowCodename.toLowerCase()
        );

        if (!workflow) {
            const errorMessages: string[] = [
                `Workflow with codename '${chalk.red(data.workflowCodename)}' does not exist in target project`,
                `Available workflows are (${config.workflows.length}): ${config.workflows
                    .map((m) => chalk.cyan(m.codename))
                    .join(', ')}`
            ];

            throw Error(errorMessages.join('. '));
        }

        const workflowStep = getWorkflowStep(workflow, data.workflowStepCodename);

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
    };

    const isPublishedStep = (stepCodename: string): boolean => {
        return config.workflows.find((workflow) => workflow.publishedStep.codename === stepCodename) ? true : false;
    };

    const isArchivedStep = (stepCodename: string): boolean => {
        return config.workflows.find((workflow) => workflow.archivedStep.codename === stepCodename) ? true : false;
    };

    const isScheduledStep = (stepCodename: string): boolean => {
        return config.workflows.find((workflow) => workflow.scheduledStep.codename === stepCodename) ? true : false;
    };

    const publishLanguageVariantAsync = async (data: {
        logSpinner: LogSpinnerData;
        workflowCodename: string;
        workflowStepCodename: string;
        migrationItem: MigrationItem;
    }): Promise<void> => {
        await runMapiRequestAsync({
            logger: config.logger,
            func: async () =>
                (
                    await config.managementClient
                        .publishLanguageVariant()
                        .byItemCodename(data.migrationItem.system.codename)
                        .byLanguageCodename(data.migrationItem.system.language.codename)
                        .withoutData()
                        .toPromise()
                ).data,
            action: 'publish',
            type: 'languageVariant',
            logSpinner: data.logSpinner,
            itemName: `${data.migrationItem.system.codename} (${data.migrationItem.system.language.codename})`
        });
    };

    const unpublishLanguageVariantAsync = async (data: {
        logSpinner: LogSpinnerData;
        workflowCodename: string;
        workflowStepCodename: string;
        migrationItem: MigrationItem;
    }): Promise<void> => {
        // unpublish the language variant first if published
        // there is no way to determine if language variant is published via MAPI
        // so we have to always try unpublishing first and catching possible errors
        try {
            await runMapiRequestAsync({
                logger: config.logger,
                func: async () =>
                    (
                        await config.managementClient
                            .unpublishLanguageVariant()
                            .byItemCodename(data.migrationItem.system.codename)
                            .byLanguageCodename(data.migrationItem.system.language.codename)
                            .withoutData()
                            .toPromise()
                    ).data,
                action: 'unpublish',
                type: 'languageVariant',
                logSpinner: data.logSpinner,
                itemName: `${data.migrationItem.system.codename} (${data.migrationItem.system.language.codename})`
            });
        } catch (error) {
            if (error instanceof SharedModels.ContentManagementBaseKontentError) {
                data.logSpinner({
                    type: 'unpublish',
                    message: `Unpublish failed, but this may be expected behavior as we cannot determine if there is a published version already. Error received: ${error.message}`
                });
            } else {
                throw error;
            }
        }
    };

    const archiveLanguageVariantAsync = async (data: {
        logSpinner: LogSpinnerData;
        workflowCodename: string;
        workflowStepCodename: string;
        migrationItem: MigrationItem;
    }): Promise<void> => {
        const { workflow } = getWorkflowAndStep(data);
        await runMapiRequestAsync({
            logger: config.logger,
            func: async () =>
                (
                    await config.managementClient
                        .changeWorkflowOfLanguageVariant()
                        .byItemCodename(data.migrationItem.system.codename)
                        .byLanguageCodename(data.migrationItem.system.language.codename)
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
            logSpinner: data.logSpinner,
            itemName: `${data.migrationItem.system.codename} (${data.migrationItem.system.language.codename}) -> ${workflow.archivedStep.codename}`
        });
    };

    const changeWorkflowOfLanguageVariantAsync = async (data: {
        logSpinner: LogSpinnerData;
        workflowCodename: string;
        workflowStepCodename: string;
        migrationItem: MigrationItem;
    }): Promise<void> => {
        const { workflow, step } = getWorkflowAndStep(data);

        await runMapiRequestAsync({
            logger: config.logger,
            func: async () =>
                (
                    await config.managementClient
                        .changeWorkflowOfLanguageVariant()
                        .byItemCodename(data.migrationItem.system.codename)
                        .byLanguageCodename(data.migrationItem.system.language.codename)
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
            logSpinner: data.logSpinner,
            itemName: `${data.migrationItem.system.codename} (${data.migrationItem.system.language.codename}) -> ${step.codename}`
        });
    };

    const setWorkflowOfLanguageVariantAsync = async (data: {
        logSpinner: LogSpinnerData;
        workflowCodename: string;
        workflowStepCodename: string;
        migrationItem: MigrationItem;
    }): Promise<void> => {
        if (isPublishedStep(data.workflowStepCodename)) {
            await publishLanguageVariantAsync(data);
        } else if (isScheduledStep(data.workflowStepCodename)) {
            data.logSpinner({
                type: 'skip',
                message: `Skipping scheduled workflow step for item '${chalk.yellow(data.migrationItem.system.name)}'`
            });
        } else if (isArchivedStep(data.workflowStepCodename)) {
            await unpublishLanguageVariantAsync(data);
            await archiveLanguageVariantAsync(data);
        } else {
            await changeWorkflowOfLanguageVariantAsync(data);
        }
    };

    return {
        getWorkflowAndStep,
        setWorkflowOfLanguageVariantAsync
    };
}
