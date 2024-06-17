import {
    ContentItemModels,
    LanguageVariantElements,
    LanguageVariantModels,
    ManagementClient,
    WorkflowModels
} from '@kontent-ai/management-sdk';
import {
    Logger,
    processInChunksAsync,
    runMapiRequestAsync,
    MigrationItem,
    exitProgram,
    extractErrorData,
    LogSpinnerData,
    MigrationElement
} from '../../core/index.js';
import chalk from 'chalk';
import { ImportContext } from '../import.models.js';
import { importTransforms } from '../../translation/index.js';
import { workflowImporter } from './workflow-importer.js';

export function languageVariantImporter(data: {
    readonly logger: Logger;
    readonly workflows: WorkflowModels.Workflow[];
    readonly preparedContentItems: ContentItemModels.ContentItem[];
    readonly importContext: ImportContext;
    readonly client: ManagementClient;
    readonly skipFailedItems: boolean;
}) {
    const importContentItemChunkSize = 1;

    const importLanguageVariantAsync = async (
        logSpinner: LogSpinnerData,
        migrationItem: MigrationItem,
        preparedContentItem: ContentItemModels.ContentItem
    ) => {
        await prepareLanguageVariantForImportAsync(logSpinner, migrationItem);

        const migrationItemWorkflowStep = migrationItem.system.workflow_step;
        const migrationItemWorkflow = migrationItem.system.workflow;

        if (!migrationItemWorkflow) {
            throw Error(`Content item '${chalk.red(migrationItem.system.codename)}' does not have a workflow assigned`);
        }

        if (!migrationItemWorkflowStep) {
            throw Error(
                `Content item '${chalk.red(migrationItem.system.codename)}' does not have a workflow step assigned`
            );
        }

        // validate workflow
        const { workflow } = workflowImporter(data.logger).getWorkflowAndStep({
            workflowCodename: migrationItemWorkflow.codename,
            workflowStepCodename: migrationItemWorkflowStep.codename,
            workflows: data.workflows
        });

        // prepare & map elements
        const mappedElements: LanguageVariantElements.ILanguageVariantElementBase[] = [];

        for (const [codename, migrationElement] of Object.entries(migrationItem.elements)) {
            mappedElements.push(await getElementContractAsync(migrationItem, migrationElement, codename));
        }

        // upsert language variant
        await runMapiRequestAsync({
            logger: data.logger,
            func: async () =>
                (
                    await data.client
                        .upsertLanguageVariant()
                        .byItemCodename(preparedContentItem.codename)
                        .byLanguageCodename(migrationItem.system.language.codename)
                        .withData(() => {
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
            logSpinner: logSpinner,
            itemName: `${migrationItem.system.codename} (${migrationItem.system.language.codename})`
        });

        // set workflow of language variant
        await workflowImporter(data.logger).setWorkflowOfLanguageVariantAsync(
            logSpinner,
            data.client,
            migrationItemWorkflow.codename,
            migrationItemWorkflowStep.codename,
            migrationItem,
            data.workflows
        );
    };

    const prepareLanguageVariantForImportAsync = async (logSpinner: LogSpinnerData, migrationItem: MigrationItem) => {
        const languageVariantState = data.importContext.getLanguageVariantStateInTargetEnvironment(
            migrationItem.system.codename,
            migrationItem.system.language.codename
        );

        const migrationItemWorkflow = migrationItem.system.workflow;
        const migrationItemWorkflowStep = migrationItem.system.workflow_step;
        const languageVariant = languageVariantState.languageVariant;

        if (!languageVariant) {
            // language variant does not exist, no need to process it any further as it will get upserted
            return;
        }

        if (!migrationItemWorkflow) {
            throw Error(
                `Item with codename '${migrationItem.system.codename}' does not have workflow property assigned`
            );
        }

        if (!migrationItemWorkflowStep) {
            throw Error(`Item with codename '${migrationItem.system.codename}' does not have workflow step assigned`);
        }

        const { workflow } = workflowImporter(data.logger).getWorkflowAndStep({
            workflows: data.workflows,
            workflowCodename: migrationItemWorkflow.codename,
            workflowStepCodename: migrationItemWorkflowStep.codename
        });

        // check if variant is published or archived
        if (isLanguageVariantPublished(languageVariant, data.workflows)) {
            // create new version
            await runMapiRequestAsync({
                logger: data.logger,
                func: async () =>
                    (
                        await data.client
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
        } else if (isLanguageVariantArchived(languageVariant, data.workflows)) {
            // change workflow step to draft
            const firstWorkflowStep = workflow.steps?.[0];

            if (firstWorkflowStep) {
                await runMapiRequestAsync({
                    logger: data.logger,
                    func: async () =>
                        (
                            await data.client
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
        }
    };

    const isLanguageVariantPublished = (
        languageVariant: LanguageVariantModels.ContentItemLanguageVariant,
        workflows: WorkflowModels.Workflow[]
    ) => {
        for (const workflow of workflows) {
            if (workflow.publishedStep.id === languageVariant.workflow.stepIdentifier.id) {
                return true;
            }
        }

        return false;
    };

    const isLanguageVariantArchived = (
        languageVariant: LanguageVariantModels.ContentItemLanguageVariant,
        workflows: WorkflowModels.Workflow[]
    ) => {
        for (const workflow of workflows) {
            if (workflow.archivedStep.id === languageVariant.workflow.stepIdentifier.id) {
                return true;
            }
        }

        return false;
    };

    const getElementContractAsync = async (
        migrationItem: MigrationItem,
        element: MigrationElement,
        elementCodename: string
    ) => {
        const flattenedElement = data.importContext.getElement(migrationItem.system.type.codename, elementCodename);

        const importTransformResult = importTransforms[flattenedElement.type]({
            elementCodename: elementCodename,
            importContext: data.importContext,
            migrationItems: data.importContext.categorizedImportData.contentItems,
            value: element.value
        });

        if (importTransformResult instanceof Promise) {
            return await importTransformResult;
        }

        return importTransformResult;
    };

    const importAsync = async () => {
        data.logger.log({
            type: 'info',
            message: `Importing '${chalk.yellow(data.importContext.categorizedImportData.contentItems.length.toString())}' language variants`
        });

        await processInChunksAsync<MigrationItem, void>({
            logger: data.logger,
            chunkSize: importContentItemChunkSize,
            items: data.importContext.categorizedImportData.contentItems,
            itemInfo: (input) => {
                return {
                    itemType: 'languageVariant',
                    title: input.system.name,
                    partA: input.system.language.codename
                };
            },
            processAsync: async (migrationItem, logSpinner) => {
                try {
                    const preparedContentItem = data.preparedContentItems.find(
                        (m) => m.codename === migrationItem.system.codename
                    );

                    if (!preparedContentItem) {
                        exitProgram({
                            message: `Invalid content item for codename '${chalk.red(migrationItem.system.codename)}'`
                        });
                    }

                    await importLanguageVariantAsync(logSpinner, migrationItem, preparedContentItem);
                } catch (error) {
                    if (data.skipFailedItems) {
                        data.logger.log({
                            type: 'error',
                            message: `Failed to import language variant '${chalk.red(
                                migrationItem.system.name
                            )}' in language '${chalk.red(migrationItem.system.language.codename)}'. Error: ${
                                extractErrorData(error).message
                            }`
                        });
                    } else {
                        throw error;
                    }
                }
            }
        });
    };

    return {
        importAsync
    };
}