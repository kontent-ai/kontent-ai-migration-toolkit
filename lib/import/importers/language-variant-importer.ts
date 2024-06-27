import {
    ContentItemModels,
    ElementContracts,
    LanguageVariantElements,
    LanguageVariantModels,
    ManagementClient,
    WorkflowModels
} from '@kontent-ai/management-sdk';
import {
    Logger,
    processSetAsync,
    runMapiRequestAsync,
    MigrationItem,
    exitProgram,
    extractErrorData,
    LogSpinnerData,
    MigrationElement,
    isNotUndefined
} from '../../core/index.js';
import chalk from 'chalk';
import { ImportContext } from '../import.models.js';
import { importTransforms } from '../../translation/index.js';
import { workflowImporter } from './workflow-importer.js';

export function languageVariantImporter(config: {
    readonly logger: Logger;
    readonly workflows: readonly WorkflowModels.Workflow[];
    readonly preparedContentItems: readonly ContentItemModels.ContentItem[];
    readonly importContext: ImportContext;
    readonly client: Readonly<ManagementClient>;
    readonly skipFailedItems: boolean;
}) {
    const upsertLanguageVariantAsync = async (data: {
        workflow: Readonly<WorkflowModels.Workflow>;
        logSpinner: LogSpinnerData;
        migrationItem: MigrationItem;
        preparedContentItem: Readonly<ContentItemModels.ContentItem>;
    }): Promise<Readonly<LanguageVariantModels.ContentItemLanguageVariant>> => {
        // prepare elelemnts to upsert
        const mappedElements: LanguageVariantElements.ILanguageVariantElementBase[] = Object.entries(
            data.migrationItem.elements
        ).map(([codename, migrationElement]) => {
            return getElementContract(data.migrationItem, migrationElement, codename);
        });

        return await runMapiRequestAsync({
            logger: config.logger,
            func: async () =>
                (
                    await config.client
                        .upsertLanguageVariant()
                        .byItemCodename(data.preparedContentItem.codename)
                        .byLanguageCodename(data.migrationItem.system.language.codename)
                        .withData(() => {
                            return {
                                elements: mappedElements,
                                workflow: {
                                    workflow_identifier: {
                                        codename: data.workflow.codename
                                    },
                                    step_identifier: {
                                        codename: data.workflow.steps[0].codename // use always first step
                                    }
                                }
                            };
                        })
                        .toPromise()
                ).data,
            action: 'upsert',
            type: 'languageVariant',
            logSpinner: data.logSpinner,
            itemName: `${data.migrationItem.system.codename} (${data.migrationItem.system.language.codename})`
        });
    };

    const importLanguageVariantAsync = async (
        logSpinner: LogSpinnerData,
        migrationItem: MigrationItem,
        preparedContentItem: Readonly<ContentItemModels.ContentItem>
    ): Promise<Readonly<LanguageVariantModels.ContentItemLanguageVariant>> => {
        await prepareLanguageVariantForImportAsync(logSpinner, migrationItem);

        const migrationItemWorkflowStep = migrationItem.system.workflow_step;
        const migrationItemWorkflow = migrationItem.system.workflow;
        const workflowImporterObj = workflowImporter({
            logger: config.logger,
            managementClient: config.client,
            workflows: config.workflows
        });

        // validate workflow
        const { workflow, step } = workflowImporterObj.getWorkflowAndStep({
            workflowCodename: migrationItemWorkflow.codename,
            workflowStepCodename: migrationItemWorkflowStep.codename
        });

        // upsert language variant
        const languageVariant = await upsertLanguageVariantAsync({
            logSpinner: logSpinner,
            migrationItem: migrationItem,
            preparedContentItem: preparedContentItem,
            workflow: workflow
        });

        // set workflow of language variant
        await workflowImporterObj.setWorkflowOfLanguageVariantAsync({
            logSpinner: logSpinner,
            workflowCodename: workflow.codename,
            workflowStepCodename: step.codename,
            migrationItem: migrationItem
        });

        return languageVariant;
    };

    const createNewVersionOfLanguageVariantAsync = async (
        logSpinner: LogSpinnerData,
        migrationItem: MigrationItem
    ): Promise<void> => {
        await runMapiRequestAsync({
            logger: config.logger,
            func: async () =>
                (
                    await config.client
                        .createNewVersionOfLanguageVariant()
                        .byItemCodename(migrationItem.system.codename)
                        .byLanguageCodename(migrationItem.system.language.codename)
                        .toPromise()
                ).data,
            action: 'createNewVersion',
            type: 'languageVariant',
            logSpinner: logSpinner,
            itemName: `${migrationItem.system.codename} (${migrationItem.system.language.codename})`
        });
    };

    const moveToDraftStepAsync = async (
        logSpinner: LogSpinnerData,
        migrationItem: MigrationItem,
        workflow: WorkflowModels.Workflow
    ): Promise<void> => {
        const firstWorkflowStep = workflow.steps?.[0];

        if (firstWorkflowStep) {
            await runMapiRequestAsync({
                logger: config.logger,
                func: async () =>
                    (
                        await config.client
                            .changeWorkflowStepOfLanguageVariant()
                            .byItemCodename(migrationItem.system.codename)
                            .byLanguageCodename(migrationItem.system.language.codename)
                            .byWorkflowStepCodename(firstWorkflowStep.codename)
                            .toPromise()
                    ).data,
                action: 'changeWorkflowStep',
                type: 'languageVariant',
                logSpinner: logSpinner,
                itemName: `${migrationItem.system.codename} (${migrationItem.system.language.codename}) -> ${firstWorkflowStep.codename}`
            });
        }
    };

    const prepareLanguageVariantForImportAsync = async (
        logSpinner: LogSpinnerData,
        migrationItem: MigrationItem
    ): Promise<void> => {
        if (!migrationItem.system.workflow) {
            throw Error(
                `Item with codename '${migrationItem.system.codename}' does not have workflow property assigned`
            );
        }

        if (!migrationItem.system.workflow_step) {
            throw Error(`Item with codename '${migrationItem.system.codename}' does not have workflow step assigned`);
        }

        const languageVariantState = config.importContext.getLanguageVariantStateInTargetEnvironment(
            migrationItem.system.codename,
            migrationItem.system.language.codename
        );

        if (!languageVariantState.languageVariant) {
            // language variant does not exist in target env, no need to process it any further as it will get upserted
            return;
        }

        const { workflow } = workflowImporter({
            logger: config.logger,
            managementClient: config.client,
            workflows: config.workflows
        }).getWorkflowAndStep({
            workflowCodename: migrationItem.system.workflow.codename,
            workflowStepCodename: migrationItem.system.workflow_step.codename
        });

        // check if variant is published or archived
        if (isLanguageVariantPublished(languageVariantState.languageVariant, config.workflows)) {
            await createNewVersionOfLanguageVariantAsync(logSpinner, migrationItem);
        } else if (isLanguageVariantArchived(languageVariantState.languageVariant, config.workflows)) {
            await moveToDraftStepAsync(logSpinner, migrationItem, workflow);
        }
    };

    const isLanguageVariantPublished = (
        languageVariant: LanguageVariantModels.ContentItemLanguageVariant,
        workflows: readonly WorkflowModels.Workflow[]
    ): boolean => {
        return workflows.find((workflow) => workflow.publishedStep.id === languageVariant.workflow.stepIdentifier.id)
            ? true
            : false;
    };

    const isLanguageVariantArchived = (
        languageVariant: LanguageVariantModels.ContentItemLanguageVariant,
        workflows: readonly WorkflowModels.Workflow[]
    ): boolean => {
        return workflows.find((workflow) => workflow.archivedStep.id === languageVariant.workflow.stepIdentifier.id)
            ? true
            : false;
    };

    const getElementContract = (
        migrationItem: MigrationItem,
        element: MigrationElement,
        elementCodename: string
    ): Readonly<ElementContracts.IContentItemElementContract> => {
        const flattenedElement = config.importContext.getElement(
            migrationItem.system.type.codename,
            elementCodename,
            element.type
        );

        const importTransformResult = importTransforms[flattenedElement.type]({
            elementCodename: elementCodename,
            importContext: config.importContext,
            migrationItems: config.importContext.categorizedImportData.contentItems,
            value: element.value
        });

        return importTransformResult;
    };

    const importAsync = async (): Promise<readonly LanguageVariantModels.ContentItemLanguageVariant[]> => {
        config.logger.log({
            type: 'info',
            message: `Importing '${chalk.yellow(
                config.importContext.categorizedImportData.contentItems.length.toString()
            )}' language variants`
        });

        return (
            await processSetAsync<MigrationItem, LanguageVariantModels.ContentItemLanguageVariant | undefined>({
                action: 'Importing language variants',
                logger: config.logger,
                parallelLimit: 1,
                items: config.importContext.categorizedImportData.contentItems,
                itemInfo: (input) => {
                    return {
                        itemType: 'languageVariant',
                        title: input.system.name,
                        partA: input.system.language.codename
                    };
                },
                processAsync: async (migrationItem, logSpinner) => {
                    try {
                        const preparedContentItem = config.preparedContentItems.find(
                            (m) => m.codename === migrationItem.system.codename
                        );

                        if (!preparedContentItem) {
                            exitProgram({
                                message: `Missing content item with codename '${chalk.red(
                                    migrationItem.system.codename
                                )}'. Content item should have been prepepared.`
                            });
                        }

                        return await importLanguageVariantAsync(logSpinner, migrationItem, preparedContentItem);
                    } catch (error) {
                        if (config.skipFailedItems) {
                            config.logger.log({
                                type: 'error',
                                message: `Failed to import language variant '${chalk.red(
                                    migrationItem.system.name
                                )}' in language '${chalk.red(migrationItem.system.language.codename)}'. Error: ${
                                    extractErrorData(error).message
                                }`
                            });

                            return undefined;
                        }

                        throw error;
                    }
                }
            })
        ).filter(isNotUndefined);
    };

    return {
        importAsync
    };
}
