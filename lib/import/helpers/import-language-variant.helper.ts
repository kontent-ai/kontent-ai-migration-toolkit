import {
    WorkflowModels,
    ContentItemModels,
    LanguageVariantModels,
    ManagementClient,
    ElementContracts,
    LanguageVariantElements
} from '@kontent-ai/management-sdk';
import {
    IImportedData,
    extractErrorData,
    is404Error,
    logItemAction,
    logDebug,
    logErrorAndExit,
    processInChunksAsync,
    LogLevel
} from '../../core/index.js';
import { IParsedContentItem, IParsedElement } from '../import.models.js';
import { ImportWorkflowHelper, getImportWorkflowHelper } from './import-workflow.helper.js';
import { ICategorizedParsedItems, parsedItemsHelper } from './parsed-items-helper.js';
import { translationHelper } from '../../translation/index.js';
import colors from 'colors';

export function getImportLanguageVariantstemHelper(config: {
    logLevel: LogLevel;
    skipFailedItems: boolean;
}): ImportLanguageVariantHelper {
    return new ImportLanguageVariantHelper(config.logLevel, config.skipFailedItems);
}

export class ImportLanguageVariantHelper {
    private readonly importContentItemChunkSize: number = 3;
    private readonly importWorkflowHelper: ImportWorkflowHelper;

    constructor(private readonly logLevel: LogLevel, private readonly skipFailedItems: boolean) {
        this.importWorkflowHelper = getImportWorkflowHelper({ logLevel: logLevel });
    }

    async importLanguageVariantsAsync(data: {
        managementClient: ManagementClient;
        importContentItems: IParsedContentItem[];
        workflows: WorkflowModels.Workflow[];
        preparedContentItems: ContentItemModels.ContentItem[];
        importedData: IImportedData;
    }): Promise<void> {
        const categorizedParsedItems: ICategorizedParsedItems = parsedItemsHelper.categorizeParsedItems(
            data.importContentItems
        );

        logItemAction(this.logLevel, 'skip', 'languageVariant', {
            title: `Skipping '${colors.yellow(
                categorizedParsedItems.componentItems.length.toString()
            )}' because they represent components`
        });

        await processInChunksAsync<IParsedContentItem, void>({
            chunkSize: this.importContentItemChunkSize,
            items: categorizedParsedItems.regularItems,
            itemInfo: (input, output) => {
                return {
                    itemType: 'languageVariant',
                    title: input.system.name,
                    partA: input.system.language
                };
            },
            processFunc: async (importContentItem) => {
                try {
                    const preparedContentItem = data.preparedContentItems.find(
                        (m) => m.codename === importContentItem.system.codename
                    );

                    if (!preparedContentItem) {
                        logErrorAndExit({
                            message: `Invalid content item for codename '${colors.red(
                                importContentItem.system.codename
                            )}'`
                        });
                    }

                    await this.importLanguageVariantAsync({
                        importContentItem,
                        preparedContentItem,
                        managementClient: data.managementClient,
                        importContentItems: data.importContentItems,
                        workflows: data.workflows,
                        importedData: data.importedData
                    });
                } catch (error) {
                    if (this.skipFailedItems) {
                        logDebug({
                            type: 'error',
                            message: `Failed to import language variant '${colors.red(
                                importContentItem.system.name
                            )}' in language '${colors.red(importContentItem.system.language)}'`,
                            partA: importContentItem.system.codename,
                            partB: extractErrorData(error).message,
                        });
                    } else {
                        throw error;
                    }
                }
            }
        });
    }

    private async importLanguageVariantAsync(data: {
        importContentItem: IParsedContentItem;
        preparedContentItem: ContentItemModels.ContentItem;
        managementClient: ManagementClient;
        importContentItems: IParsedContentItem[];
        workflows: WorkflowModels.Workflow[];
        importedData: IImportedData;
    }): Promise<void> {
        await this.prepareLanguageVariantForImportAsync({
            importContentItem: data.importContentItem,
            managementClient: data.managementClient,
            workflows: data.workflows
        });

        logItemAction(this.logLevel, 'upsert', 'languageVariant', {
            title: `${data.preparedContentItem.name}`,
            language: data.importContentItem.system.language,
            codename: data.importContentItem.system.codename,
            workflowStep: data.importContentItem.system.workflow_step
        });

        const upsertedLanguageVariant = await data.managementClient
            .upsertLanguageVariant()
            .byItemCodename(data.preparedContentItem.codename)
            .byLanguageCodename(data.importContentItem.system.language)
            .withData((builder) => {
                const mappedElements: LanguageVariantElements.ILanguageVariantElementBase[] =
                    data.importContentItem.elements.map((m) =>
                        this.getElementContract(data.importContentItems, m, data.importedData)
                    );

                return {
                    elements: mappedElements
                };
            })
            .toPromise()
            .then((m) => m.data);

        data.importedData.languageVariants.push({
            original: data.importContentItem,
            imported: upsertedLanguageVariant
        });

        // set workflow of language variant
        if (data.importContentItem.system.workflow_step) {
            await this.importWorkflowHelper.setWorkflowOfLanguageVariantAsync(
                data.managementClient,
                data.importContentItem.system.workflow_step,
                data.importContentItem,
                data.workflows
            );
        }
    }

    private async prepareLanguageVariantForImportAsync(data: {
        managementClient: ManagementClient;
        importContentItem: IParsedContentItem;
        workflows: WorkflowModels.Workflow[];
    }): Promise<void> {
        let languageVariantOfContentItem: undefined | LanguageVariantModels.ContentItemLanguageVariant;

        try {
            logItemAction(this.logLevel, 'fetch', 'languageVariant', {
                title: `${data.importContentItem.system.name}`,
                language: data.importContentItem.system.language,
                codename: data.importContentItem.system.codename,
                workflowStep: data.importContentItem.system.workflow_step
            });

            languageVariantOfContentItem = await data.managementClient
                .viewLanguageVariant()
                .byItemCodename(data.importContentItem.system.codename)
                .byLanguageCodename(data.importContentItem.system.language)
                .toPromise()
                .then((m) => m.data);

            if (!languageVariantOfContentItem) {
                logErrorAndExit({
                    message: `Invalid langauge variant for item '${colors.red(
                        data.importContentItem.system.codename
                    )}' of type '${colors.yellow(data.importContentItem.system.type)}' and language '${colors.yellow(
                        data.importContentItem.system.language
                    )}'`
                });
            }
        } catch (error) {
            if (!is404Error(error)) {
                throw error;
            }
        }

        if (languageVariantOfContentItem) {
            // language variant exists
            // check if variant is published or archived
            if (this.isLanguageVariantPublished(languageVariantOfContentItem, data.workflows)) {
                logItemAction(this.logLevel, 'createNewVersion', 'languageVariant', {
                    title: `${data.importContentItem.system.name}`,
                    language: data.importContentItem.system.language,
                    codename: data.importContentItem.system.codename,
                    workflowStep: data.importContentItem.system.workflow_step
                });

                // create new version
                await data.managementClient
                    .createNewVersionOfLanguageVariant()
                    .byItemCodename(data.importContentItem.system.codename)
                    .byLanguageCodename(data.importContentItem.system.language)
                    .toPromise();
            } else if (this.isLanguageVariantArchived(languageVariantOfContentItem, data.workflows)) {
                // change workflow step to draft
                if (languageVariantOfContentItem.workflow.stepIdentifier.id) {
                    const workflow = this.importWorkflowHelper.getWorkflowForGivenStepById(
                        languageVariantOfContentItem.workflow.stepIdentifier.id,
                        data.workflows
                    );
                    const newWorkflowStep = workflow.steps[0];

                    logItemAction(this.logLevel, 'unArchive', 'languageVariant', {
                        title: `${data.importContentItem.system.name}`,
                        language: data.importContentItem.system.language,
                        codename: data.importContentItem.system.codename,
                        workflowStep: data.importContentItem.system.workflow_step
                    });

                    await data.managementClient
                        .changeWorkflowStepOfLanguageVariant()
                        .byItemCodename(data.importContentItem.system.codename)
                        .byLanguageCodename(data.importContentItem.system.language)
                        .byWorkflowStepCodename(newWorkflowStep.codename)
                        .toPromise();
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
            logErrorAndExit({
                message: `Missing import contract for element '${colors.red(element.codename)}' `
            });
        }

        return importContract;
    }
}
