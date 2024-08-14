import { ContentItemModels, ElementContracts, LanguageVariantModels, ManagementClient, WorkflowModels } from '@kontent-ai/management-sdk';
import {
    Logger,
    processItemsAsync,
    runMapiRequestAsync,
    MigrationItem,
    LogSpinnerData,
    MigrationElement,
    MigrationItemVersion,
    workflowHelper,
    findRequired,
    isNotUndefined,
    LanguageVariantSchedulesStateValues,
    LanguageVariantStateInTargetEnvironmentByCodename
} from '../../core/index.js';
import chalk from 'chalk';
import { ImportContext } from '../import.models.js';
import { importTransforms } from '../../translation/index.js';
import { workflowImporter as workflowImporterInit } from './workflow-importer.js';
import { throwErrorForMigrationItem } from '../utils/import.utils.js';

export function languageVariantImporter(config: {
    readonly logger: Logger;
    readonly preparedContentItems: readonly ContentItemModels.ContentItem[];
    readonly importContext: ImportContext;
    readonly client: Readonly<ManagementClient>;
}) {
    const workflowImporter = workflowImporterInit({
        logger: config.logger,
        managementClient: config.client,
        workflows: config.importContext.environmentData.workflows
    });

    const upsertLanguageVariantAsync = async (data: {
        readonly workflow: Readonly<WorkflowModels.Workflow>;
        readonly logSpinner: LogSpinnerData;
        readonly migrationItem: MigrationItem;
        readonly migrationItemVersion: MigrationItemVersion;
        readonly preparedContentItem: Readonly<ContentItemModels.ContentItem>;
    }): Promise<Readonly<LanguageVariantModels.ContentItemLanguageVariant>> => {
        return await runMapiRequestAsync({
            logger: config.logger,
            func: async () => {
                return (
                    await config.client
                        .upsertLanguageVariant()
                        .byItemCodename(data.preparedContentItem.codename)
                        .byLanguageCodename(data.migrationItem.system.language.codename)
                        .withData(() => {
                            return {
                                elements: Object.entries(data.migrationItemVersion.elements).map(([codename, migrationElement]) => {
                                    return getElementContract(data.migrationItem, migrationElement, codename);
                                }),
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
                ).data;
            },
            action: 'upsert',
            type: 'languageVariant',
            logSpinner: data.logSpinner,
            itemName: `${data.migrationItem.system.codename} (${data.migrationItem.system.language.codename})`
        });
    };

    const categorizeVersions = (
        migrationItem: MigrationItem
    ): { publishedVersion: MigrationItemVersion | undefined; draftVersion: MigrationItemVersion | undefined } => {
        const workflow = workflowHelper(config.importContext.environmentData.workflows).getWorkflowByCodename(
            migrationItem.system.workflow.codename
        );

        const publishedVersions = migrationItem.versions.filter((version) =>
            isPublishedWorkflowStep(version.workflow_step.codename, workflow)
        );
        const draftVersions = migrationItem.versions.filter(
            (version) => !isPublishedWorkflowStep(version.workflow_step.codename, workflow)
        );

        if (publishedVersions.length > 1) {
            throwErrorForMigrationItem(
                migrationItem,
                `There can be only 1 published version. There are '${publishedVersions.length}' published versions for the item.`
            );
        }

        if (draftVersions.length > 1) {
            throwErrorForMigrationItem(
                migrationItem,
                `There can be only 1 draft version. There are '${draftVersions.length}' draft versions for the item.`
            );
        }

        return {
            draftVersion: draftVersions?.[0],
            publishedVersion: publishedVersions?.[0]
        };
    };

    const importVersionAsync = async (data: {
        readonly logSpinner: LogSpinnerData;
        readonly migrationItem: MigrationItem;
        readonly migrationItemVersion: MigrationItemVersion;
        readonly preparedContentItem: Readonly<ContentItemModels.ContentItem>;
        readonly createNewVersion?: boolean;
    }): Promise<Readonly<LanguageVariantModels.ContentItemLanguageVariant>> => {
        // validate workflow
        const { step, workflow } = workflowHelper(config.importContext.environmentData.workflows).getWorkflowAndStepByCodenames({
            workflowCodename: data.migrationItem.system.workflow.codename,
            stepCodename: data.migrationItemVersion.workflow_step.codename
        });

        // create new version if necessary. This is needed when both draft & published version are imported
        if (data.createNewVersion) {
            await workflowImporter.createNewVersionOfLanguageVariantAsync({
                logSpinner: data.logSpinner,
                migrationItem: data.migrationItem
            });
        }
        // upsert language variant
        const languageVariant = await upsertLanguageVariantAsync({
            logSpinner: data.logSpinner,
            migrationItem: data.migrationItem,
            preparedContentItem: data.preparedContentItem,
            migrationItemVersion: data.migrationItemVersion,
            workflow
        });

        // set workflow accordingly (publish, move to workflow step, archive ...)
        await workflowImporter.setWorkflowOfLanguageVariantAsync({
            logSpinner: data.logSpinner,
            migrationItem: data.migrationItem,
            workflowCodename: workflow.codename,
            stepCodename: step.codename,
            migrationItemVersion: data.migrationItemVersion
        });

        return languageVariant;
    };

    const importLanguageVariantAsync = async (
        logSpinner: LogSpinnerData,
        migrationItem: MigrationItem,
        preparedContentItem: Readonly<ContentItemModels.ContentItem>
    ): Promise<readonly LanguageVariantModels.ContentItemLanguageVariant[]> => {
        const { draftVersion, publishedVersion } = categorizeVersions(migrationItem);

        // get initial state of language variant from target env
        const targetVariantState = config.importContext.getLanguageVariantStateInTargetEnvironment(
            migrationItem.system.codename,
            migrationItem.system.language.codename
        );

        // prepare language variant for import (unpublish, create new version, un-schedule ...)
        await prepareTargetEnvironmentVariantForImportAsync({
            logSpinner,
            migrationItem,
            targetVariantState
        });

        // first import published version if it exists
        const publishedLanguageVariant: Readonly<LanguageVariantModels.ContentItemLanguageVariant> | undefined = publishedVersion
            ? await importVersionAsync({
                  logSpinner: logSpinner,
                  migrationItem: migrationItem,
                  preparedContentItem: preparedContentItem,
                  migrationItemVersion: publishedVersion
              })
            : undefined;

        // if target env contains published version & imported version not, unpublish it from the target env
        if (targetVariantState.publishedLanguageVariant && !publishedVersion) {
            await workflowImporter.unpublishLanguageVariantAsync({
                logSpinner,
                migrationItem
            });
            await workflowImporter.moveToDraftStepAsync({
                logSpinner,
                migrationItem
            });
        }
        const draftLanguageVariant: Readonly<LanguageVariantModels.ContentItemLanguageVariant> | undefined = draftVersion
            ? await importVersionAsync({
                  logSpinner: logSpinner,
                  migrationItem: migrationItem,
                  preparedContentItem: preparedContentItem,
                  migrationItemVersion: draftVersion,
                  createNewVersion: publishedLanguageVariant ? true : false
              })
            : undefined;

        return [publishedLanguageVariant, draftLanguageVariant].filter(isNotUndefined);
    };

    const cancelScheduledStateAsync = async (data: {
        readonly logSpinner: LogSpinnerData;
        readonly migrationItem: MigrationItem;
        readonly scheduledState: LanguageVariantSchedulesStateValues;
    }): Promise<void> => {
        const changeWorkflowData = {
            logSpinner: data.logSpinner,
            migrationItem: data.migrationItem
        };

        switch (data.scheduledState) {
            case 'scheduledPublish':
                // cancel scheduled publish if language variant is scheduled to be published
                await workflowImporter.cancelScheduledPublishAsync(changeWorkflowData);
                break;
            case 'scheduledUnpublish':
                // cancel scheduled unpublish if language variant is scheduled to be unpublished
                await workflowImporter.cancelScheduledUnpublishAsync(changeWorkflowData);
                break;
        }
    };

    const prepareTargetEnvironmentVariantForImportAsync = async (data: {
        readonly logSpinner: LogSpinnerData;
        readonly migrationItem: MigrationItem;
        readonly targetVariantState: LanguageVariantStateInTargetEnvironmentByCodename;
    }): Promise<void> => {
        if (!data.targetVariantState) {
            // no need to prepare language variant as it doesn't exist in target environment
            return;
        }

        // when language variant exists in target env, we need to prepare it for import by unscheduling, moving to draft etc...
        // we use draft language variant if it exists, otherwise we use published language variant
        const languageVariantToPrepare = data.targetVariantState.draftLanguageVariant ?? data.targetVariantState.publishedLanguageVariant;

        if (!languageVariantToPrepare) {
            return;
        }

        // there is likely a bug which causes /published endpoint to return invalid scheduled state
        // use conditions below to determine scheduled state to use - this will be fixed in future
        if (languageVariantToPrepare.workflowState?.scheduledState) {
            await cancelScheduledStateAsync({
                logSpinner: data.logSpinner,
                migrationItem: data.migrationItem,
                scheduledState: languageVariantToPrepare.workflowState.scheduledState
            });
        }

        const changeWorkflowData = {
            logSpinner: data.logSpinner,
            migrationItem: data.migrationItem
        };

        switch (languageVariantToPrepare.workflowState?.workflowState) {
            case 'published':
                // create new version if language variant is published
                await workflowImporter.createNewVersionOfLanguageVariantAsync(changeWorkflowData);
                break;
            case 'archived':
                // move to draft step if language variant is archived
                await workflowImporter.moveToDraftStepAsync(changeWorkflowData);
                break;
        }
    };

    const isPublishedWorkflowStep = (stepCodename: string, workflow: Readonly<WorkflowModels.Workflow>): boolean => {
        return workflow.publishedStep.codename === stepCodename;
    };

    const getElementContract = (
        migrationItem: MigrationItem,
        element: MigrationElement,
        elementCodename: string
    ): Readonly<ElementContracts.IContentItemElementContract> => {
        const importTransformResult = importTransforms[
            config.importContext.getElement(migrationItem.system.type.codename, elementCodename, element.type).type
        ]({
            elementCodename: elementCodename,
            importContext: config.importContext,
            migrationItems: config.importContext.categorizedImportData.contentItems,
            value: element.value
        });

        return importTransformResult;
    };

    const importAsync = async (): Promise<readonly Readonly<LanguageVariantModels.ContentItemLanguageVariant>[]> => {
        config.logger.log({
            type: 'info',
            message: `Importing '${chalk.yellow(
                config.importContext.categorizedImportData.contentItems.length.toString()
            )}' language variants`
        });

        return (
            await processItemsAsync<MigrationItem, readonly Readonly<LanguageVariantModels.ContentItemLanguageVariant>[]>({
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
                    const contentItem = findRequired(
                        config.preparedContentItems,
                        (item) => item.codename === migrationItem.system.codename,
                        `Missing content item with codename '${chalk.red(
                            migrationItem.system.codename
                        )}'. Content item should have been prepepared.`
                    );

                    return await importLanguageVariantAsync(logSpinner, migrationItem, contentItem);
                }
            })
        ).flatMap((m) => m.map((s) => s));
    };

    return {
        importAsync
    };
}
