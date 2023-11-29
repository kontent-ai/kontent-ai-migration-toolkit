import {
    WorkflowModels,
    ContentItemModels,
    LanguageVariantModels,
    ManagementClient,
    ElementContracts
} from '@kontent-ai/management-sdk';
import { logDebug } from '../../core/log-helper';
import { IImportedData, extractErrorMessage, is404Error, logAction, translationHelper } from '../../core';
import { IParsedContentItem, IParsedElement } from '../import.models';
import { importWorkflowHelper } from './import-workflow.helper';

export class ImportLanguageVariantHelper {
    async importLanguageVariantsAsync(
        managementClient: ManagementClient,
        importContentItems: IParsedContentItem[],
        workflows: WorkflowModels.Workflow[],
        preparedContentItems: ContentItemModels.ContentItem[],
        importedData: IImportedData,
        config: {
            skipFailedItems: boolean;
        }
    ): Promise<void> {
        let itemIndex: number = 0;
        for (const importContentItem of importContentItems) {
            try {
                itemIndex++;

                logDebug({
                    type: 'info',
                    processingIndex: {
                        index: itemIndex,
                        totalCount: importContentItems.length
                    },
                    message: `Processing language variant '${importContentItem.system.name}'`,
                    partA: importContentItem.system.codename,
                    partB: importContentItem.system.language
                });

                // if content item does not have a workflow step it means it is used as a component within Rich text element
                // such items are procesed within element transform
                if (!importContentItem.system.workflow_step) {
                    logAction('skip', 'contentItem', {
                        title: `Skipping item beause it's a component`,
                        codename: importContentItem.system.codename
                    });
                    continue;
                }

                const upsertedContentItem = preparedContentItems.find(
                    (m) => m.codename === importContentItem.system.codename
                );

                if (!upsertedContentItem) {
                    throw Error(`Invalid content item for codename '${importContentItem.system.codename}'`);
                }

                await this.prepareLanguageVariantForImportAsync(managementClient, importContentItem, workflows);

                const upsertedLanguageVariant = await managementClient
                    .upsertLanguageVariant()
                    .byItemCodename(upsertedContentItem.codename)
                    .byLanguageCodename(importContentItem.system.language)
                    .withData((builder) => {
                        return {
                            elements: importContentItem.elements.map((m) =>
                                this.getElementContract(importContentItems, m, importedData)
                            )
                        };
                    })
                    .toPromise()
                    .then((m) => m.data);

                importedData.languageVariants.push({
                    original: importContentItem,
                    imported: upsertedLanguageVariant
                });

                logAction('upsert', 'languageVariant', {
                    title: `${upsertedContentItem.name}`,
                    language: importContentItem.system.language
                });

                // set workflow of language variant
                if (importContentItem.system.workflow_step) {
                    await importWorkflowHelper.setWorkflowOfLanguageVariantAsync(
                        managementClient,
                        importContentItem.system.workflow_step,
                        importContentItem,
                        workflows
                    );
                }
            } catch (error) {
                if (config.skipFailedItems) {
                    logDebug({
                        type: 'error',
                        message: `Failed to import language variant '${importContentItem.system.name}' in language '${importContentItem.system.language}'`,
                        partA: importContentItem.system.codename,
                        partB: extractErrorMessage(error)
                    });
                } else {
                    throw error;
                }
            }
        }
    }

    private async prepareLanguageVariantForImportAsync(
        managementClient: ManagementClient,
        importContentItem: IParsedContentItem,
        workflows: WorkflowModels.Workflow[]
    ): Promise<void> {
        let languageVariantOfContentItem: undefined | LanguageVariantModels.ContentItemLanguageVariant;

        try {
            languageVariantOfContentItem = await managementClient
                .viewLanguageVariant()
                .byItemCodename(importContentItem.system.codename)
                .byLanguageCodename(importContentItem.system.language)
                .toPromise()
                .then((m) => m.data);

            logAction('fetch', 'languageVariant', {
                title: `${importContentItem.system.name}`,
                language: importContentItem.system.language
            });

            if (!languageVariantOfContentItem) {
                throw Error(
                    `Invalid langauge variant for item '${importContentItem.system.codename}' of type '${importContentItem.system.type}' and language '${importContentItem.system.language}'`
                );
            }
        } catch (error) {
            if (!is404Error(error)) {
                throw error;
            }
        }

        if (languageVariantOfContentItem) {
            // language variant exists
            // check if variant is published or archived
            if (this.isLanguageVariantPublished(languageVariantOfContentItem, workflows)) {
                // create new version
                await managementClient
                    .createNewVersionOfLanguageVariant()
                    .byItemCodename(importContentItem.system.codename)
                    .byLanguageCodename(importContentItem.system.language)
                    .toPromise();

                logAction('createNewVersion', 'languageVariant', {
                    title: `${importContentItem.system.name}`,
                    language: importContentItem.system.language
                });
            } else if (this.isLanguageVariantArchived(languageVariantOfContentItem, workflows)) {
                // change workflow step to draft
                if (languageVariantOfContentItem.workflow.stepIdentifier.id) {
                    const workflow = importWorkflowHelper.getWorkflowForGivenStepById(
                        languageVariantOfContentItem.workflow.stepIdentifier.id,
                        workflows
                    );
                    const newWorkflowStep = workflow.steps[0];

                    await managementClient
                        .changeWorkflowStepOfLanguageVariant()
                        .byItemCodename(importContentItem.system.codename)
                        .byLanguageCodename(importContentItem.system.language)
                        .byWorkflowStepCodename(newWorkflowStep.codename)
                        .toPromise();

                    logAction('unArchive', 'languageVariant', {
                        title: `${importContentItem.system.name}`,
                        language: importContentItem.system.language,
                        workflowStep: newWorkflowStep.codename
                    });
                }
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

    private getElementContract(
        sourceItems: IParsedContentItem[],
        element: IParsedElement,
        importedData: IImportedData
    ): ElementContracts.IContentItemElementContract {
        const importContract = translationHelper.transformToImportValue(
            element.value,
            element.codename,
            element.type,
            importedData,
            sourceItems
        );

        if (!importContract) {
            throw Error(`Missing import contract for element `);
        }

        return importContract;
    }
}

export const importLanguageVariantHelper = new ImportLanguageVariantHelper();
