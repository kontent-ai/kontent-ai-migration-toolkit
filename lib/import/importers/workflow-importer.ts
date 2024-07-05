import { ManagementClient, SharedModels, WorkflowModels } from '@kontent-ai/management-sdk';
import { Logger, runMapiRequestAsync, LogSpinnerData, MigrationItem, workflowHelper } from '../../core/index.js';

export function workflowImporter(config: {
    logger: Logger;
    managementClient: Readonly<ManagementClient>;
    workflows: readonly Readonly<WorkflowModels.Workflow>[];
}) {
    const publishLanguageVariantAsync = async (data: {
        readonly logSpinner: LogSpinnerData;
        readonly migrationItem: MigrationItem;
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
        readonly logSpinner: LogSpinnerData;
        readonly migrationItem: MigrationItem;
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
        readonly logSpinner: LogSpinnerData;
        readonly workflowCodename: string;
        readonly migrationItem: MigrationItem;
    }): Promise<void> => {
        const workflow = workflowHelper(config.workflows).getWorkflowByCodename(data.workflowCodename);
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
        readonly logSpinner: LogSpinnerData;
        readonly workflowCodename: string;
        readonly stepCodename: string;
        readonly migrationItem: MigrationItem;
    }): Promise<void> => {
        const { workflow, step } = workflowHelper(config.workflows).getWorkflowAndStepByCodenames({
            workflowCodename: data.workflowCodename,
            stepCodename: data.stepCodename
        });

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
        readonly logSpinner: LogSpinnerData;
        readonly workflowCodename: string;
        readonly stepCodename: string;
        readonly migrationItem: MigrationItem;
    }): Promise<void> => {
        if (workflowHelper(config.workflows).isPublishedStepByCodename(data.stepCodename)) {
            await publishLanguageVariantAsync(data);
        } else if (workflowHelper(config.workflows).isScheduledStepByCodename(data.stepCodename)) {
            data.logSpinner({
                type: 'skip',
                message: `${data.migrationItem.system.codename} (${data.migrationItem.system.language.codename}) -> Skipping scheduled workflow step assignment`
            });
        } else if (workflowHelper(config.workflows).isArchivedStepByCodename(data.stepCodename)) {
            await unpublishLanguageVariantAsync(data);
            await archiveLanguageVariantAsync(data);
        } else {
            await changeWorkflowOfLanguageVariantAsync(data);
        }
    };

    return {
        setWorkflowOfLanguageVariantAsync,
        publishLanguageVariantAsync
    };
}
