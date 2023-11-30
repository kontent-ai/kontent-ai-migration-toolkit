import {
    WorkflowModels,
    ContentItemModels,
    LanguageVariantModels,
    ManagementClient,
    ElementContracts,
    LanguageVariantElements
} from '@kontent-ai/management-sdk';
import { logDebug, logProcessingDebug } from '../../core/log-helper.js';
import { IImportedData, extractErrorMessage, is404Error, logAction, translationHelper } from '../../core/index.js';
import { IParsedContentItem, IParsedElement } from '../import.models.js';
import { importWorkflowHelper } from './import-workflow.helper.js';
import { FileService } from '../../node/index.js';

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

                if (
                    !['sync_api_limitations', 'delivery_api', 'cdn_and_content_caching'].find(
                        (m) => m === importContentItem.system.codename
                    )
                ) {
                    continue;
                }

                logProcessingDebug({
                    index: itemIndex,
                    totalCount: importContentItems.length,
                    itemType: 'languageVariant',
                    title: `'${importContentItem.system.name}' in language '${importContentItem.system.language}'`
                });

                // if content item does not have a workflow step it means it is used as a component within Rich text element
                // such items are procesed within element transform
                if (!importContentItem.system.workflow_step) {
                    logAction('skip', 'languageVariant', {
                        title: `Skipping item beause it's a component`,
                        language: importContentItem.system.language,
                        codename: importContentItem.system.codename,
                        workflowStep: importContentItem.system.workflow_step
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
                        let mappedElements: LanguageVariantElements.ILanguageVariantElementBase[] | any =
                            importContentItem.elements.map((m) =>
                                this.getElementContract(importContentItems, m, importedData)
                            );

                        if (importContentItem.system.codename === 'delivery_api') {
                            mappedElements = [
                                { element: { codename: 'title' }, value: 'Delivery REST API' },
                                { element: { codename: 'description' }, components: [], value: '<p><br></p>' },
                                {
                                    element: { codename: 'content' },
                                    components: [
                                        {
                                            id: '325e2acb-1c14-47f6-af9a-27bc8b6c16fe',
                                            type: { codename: 'zapi_section_group' },
                                            elements: [
                                                { element: { codename: 'title' }, value: 'Introduction' },
                                                {
                                                    element: { codename: 'sections' },
                                                    value: [
                                                        { codename: 'about_delivery_api' },
                                                        { codename: 'published_content_vs__preview' },
                                                        { codename: 'try_the_api_with_postman' },
                                                        { codename: 'sdks_9d7355e' },
                                                        { codename: 'authentication_in_delivery_api' },
                                                        { codename: 'delivery_api_keys' },
                                                        { codename: 'api_limitations' },
                                                        { codename: 'cdn_and_content_caching' },
                                                        { codename: 'errors_f80180f' }
                                                    ]
                                                }
                                            ]
                                        },
                                    ],
                                    value: '<object type="application/kenticocloud" data-type="component" data-id="325e2acb-1c14-47f6-af9a-27bc8b6c16fe"></object>'
                                },
                                {
                                    element: { codename: 'categories' },
                                    value: [
                                        { codename: 'try_the_api_with_postman' },
                                        { codename: 'sdks_9d7355e' },
                                        { codename: 'cdn_and_content_caching' },
                                        { codename: 'api_limitations' },
                                        { codename: 'errors_f80180f' },
                                        { codename: 'filtering_content' },
                                        { codename: 'linked_content_and_components' },
                                        { codename: 'content_items' },
                                        { codename: 'content_elements' },
                                        { codename: 'content_types' },
                                        { codename: 'languages_28f769b' },
                                        { codename: 'taxonomy_groups' },
                                        { codename: 'delivery_api_keys' },
                                        { codename: 'authentication_in_delivery_api' },
                                        { codename: 'published_content_vs__preview' }
                                    ]
                                },
                                { element: { codename: 'url' }, value: 'openapi/delivery-api', mode: 'custom' },
                                {
                                    element: { codename: 'redirect_urls' },
                                    value: '/reference/delivery-rest-api;\n/reference/delivery-api;\n/reference/openapi/delivery-api;'
                                },
                                { element: { codename: 'version' }, value: '1' },
                                {
                                    element: { codename: 'servers' },
                                    components: [
                                        // {
                                        //     id: 'n607dd188-8849-0177-5ff8-487f2d71ce9f',
                                        //     type: { codename: 'zapi_base_url' },
                                        //     elements: [
                                        //         { element: { codename: 'description' }, value: 'Delivery API' },
                                        //         {
                                        //             element: { codename: 'url' },
                                        //             value: 'https://deliver.kontent.ai'
                                        //         }
                                        //     ]
                                        // },
                                        // {
                                        //     id: 'd1581862-4f14-0193-d56c-44485f2aa6b1',
                                        //     type: { codename: 'zapi_base_url' },
                                        //     elements: [
                                        //         {
                                        //             element: { codename: 'description' },
                                        //             value: 'Delivery Preview API'
                                        //         },
                                        //         {
                                        //             element: { codename: 'url' },
                                        //             value: 'https://preview-deliver.kontent.ai'
                                        //         }
                                        //     ]
                                        // }
                                    ],
                                    value: '<p></p>'
                                },
                                {
                                    element: { codename: 'security' },
                                    value: [{ codename: 'delivery_api_bearer_authentication' }]
                                },
                                { element: { codename: 'api_reference' }, value: [{ codename: 'delivery_api' }] },
                                { element: { codename: 'build_an_open_api_document_for_this_api' }, value: '' }
                            ];
                        }

                        new FileService().writeFileAsync('log.json', JSON.stringify(mappedElements));
                        return {
                            elements: mappedElements
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
                    language: importContentItem.system.language,
                    codename: importContentItem.system.codename,
                    workflowStep: importContentItem.system.workflow_step
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
                language: importContentItem.system.language,
                codename: importContentItem.system.codename,
                workflowStep: importContentItem.system.workflow_step
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
                    language: importContentItem.system.language,
                    codename: importContentItem.system.codename,
                    workflowStep: importContentItem.system.workflow_step
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
                        codename: importContentItem.system.codename,
                        workflowStep: importContentItem.system.workflow_step
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
