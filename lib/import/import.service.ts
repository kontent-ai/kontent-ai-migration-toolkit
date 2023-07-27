import {
    AssetResponses,
    CollectionModels,
    ContentItemModels,
    ElementContracts,
    LanguageVariantModels,
    ManagementClient,
    SharedModels,
    WorkflowModels
} from '@kontent-ai/management-sdk';
import { version, name } from '../../package.json';

import {
    IImportItemResult,
    ActionType,
    handleError,
    defaultRetryStrategy,
    printProjectAndEnvironmentInfoToConsoleAsync,
    translationHelper,
    ItemType,
    defaultWorkflowCodename
} from '../core';
import {
    IImportAsset,
    IImportConfig,
    IParsedContentItem,
    IParsedElement,
    IImportSource,
    IImportContentType,
    IImportContentTypeElement
} from './import.models';
import { HttpService } from '@kontent-ai/core-sdk';
import { DeliveryClient, ElementType } from '@kontent-ai/delivery-sdk';
import { logDebug } from '../core/log-helper';

export class ImportService {
    private readonly managementClient: ManagementClient;
    private readonly deliveryClient: DeliveryClient;

    /**
     * Maximum allowed size of asset in Bytes.
     * Currently 1e8 = 100 MB
     */
    // private readonly maxAllowedAssetSizeInBytes: number = 1e8;

    constructor(private config: IImportConfig) {
        this.managementClient = new ManagementClient({
            apiKey: config.apiKey,
            baseUrl: config.baseUrl,
            environmentId: config.environmentId,
            httpService: new HttpService({
                logErrorsToConsole: false
            }),
            retryStrategy: config.retryStrategy ?? defaultRetryStrategy
        });
        this.deliveryClient = new DeliveryClient({
            environmentId: config.environmentId,
            secureApiKey: config.secureApiKey,
            httpService: new HttpService({
                logErrorsToConsole: false
            }),
            defaultQueryConfig: {
                useSecuredMode: config.secureApiKey ? true : false
            },
            proxy: {
                baseUrl: config.baseUrl
            },
            retryStrategy: config.retryStrategy ?? defaultRetryStrategy
        });
    }

    async getImportContentTypesAsync(): Promise<IImportContentType[]> {
        logDebug('info', `Fetching content types from environment`);
        const contentTypes = await this.deliveryClient
            .types()
            .toAllPromise()
            .then((m) => m.data.items);
        logDebug('info', `Fetched '${contentTypes.length}' content types`);

        return contentTypes.map((contentType) => {
            const importType: IImportContentType = {
                contentTypeCodename: contentType.system.codename,
                elements: contentType.elements.map((element) => {
                    const importElement: IImportContentTypeElement = {
                        codename: element.codename ?? '',
                        type: element.type as ElementType
                    };

                    return importElement;
                })
            };

            return importType;
        });
    }

    async importFromSourceAsync(sourceData: IImportSource): Promise<IImportItemResult[]> {
        return await this.importAsync(sourceData);
    }

    async importAsync(sourceData: IImportSource): Promise<IImportItemResult[]> {
        const importedItems: IImportItemResult[] = [];
        await printProjectAndEnvironmentInfoToConsoleAsync(this.managementClient);

        // log information regarding version mismatch
        if (sourceData.metadata) {
            if (version !== sourceData.metadata.csvManagerVersion) {
                console.warn(
                    `WARNING: Version mismatch. Current version of '${name}' is '${version}', but export was created using version '${sourceData.metadata.csvManagerVersion}'.`
                );
                console.warn(
                    `Import may still succeed, but if it doesn't, please try using '${sourceData.metadata.csvManagerVersion}' version of this library.`
                );
            }
        }

        // this is an optional step where users can exclude certain objects from being imported
        const dataToImport = this.getDataToImport(sourceData);

        // import order matters
        try {
            //  Assets
            if (dataToImport.importData.assets.length) {
                logDebug('info', `Importing assets`);
                const importedAssets = await this.importAssetsAsync(dataToImport.importData.assets);
                importedItems.push(...importedAssets);
            } else {
                logDebug('info', `There are no assets to import`);
            }

            // Content items
            if (dataToImport.importData.items.length) {
                logDebug('info', `Importing content items`);
                await this.importContentItemsAsync(dataToImport.importData.items, importedItems);
            } else {
                logDebug('info', `There are no content items to import`);
            }

            logDebug('info', `Finished import`);
        } catch (error) {
            this.handleImportError(error);
        }
        return importedItems;
    }

    private getDataToImport(source: IImportSource): IImportSource {
        const dataToImport: IImportSource = {
            importData: {
                assets: [],
                items: []
            },
            metadata: source.metadata
        };

        let removedAssets: number = 0;
        let removedContentItems: number = 0;

        if (this.config?.canImport?.asset) {
            for (const asset of source.importData.assets) {
                const canImport = this.config.canImport.asset(asset);
                if (canImport) {
                    dataToImport.importData.assets.push(asset);
                    removedAssets++;
                }
            }
        } else {
            dataToImport.importData.assets = source.importData.assets;
        }

        if (this.config?.canImport?.contentItem) {
            for (const item of source.importData.items) {
                const canImport = this.config.canImport.contentItem(item);
                if (canImport) {
                    dataToImport.importData.items.push(item);
                    removedContentItems++;
                }
            }
        } else {
            dataToImport.importData.items = source.importData.items;
        }

        if (removedAssets > 0) {
            logDebug('info', `Removed '${removedAssets.toString()}' assets from import`);
        }

        if (removedContentItems) {
            logDebug('info', `Removed '${removedContentItems.toString()}' content items from import`);
        }

        return dataToImport;
    }

    private async importAssetsAsync(assets: IImportAsset[]): Promise<IImportItemResult[]> {
        const importedItems: IImportItemResult[] = [];

        for (const asset of assets) {
            // use asset id as external id
            const assetExternalId: string = asset.assetId;

            // check if asset with given external id already exists
            let existingAsset: AssetResponses.ViewAssetResponse | undefined;

            try {
                // when target project is the same as source project, the id of asset would be the same
                // and such asset should not be imported again
                existingAsset = await this.managementClient.viewAsset().byAssetExternalId(asset.assetId).toPromise();
            } catch (error) {
                let throwError = true;

                if (error instanceof SharedModels.ContentManagementBaseKontentError) {
                    if (error.originalError?.response?.status === 404) {
                        throwError = false;
                    }
                }

                if (throwError) {
                    throw error;
                }
            }

            try {
                // check if asset with given external id was already created
                existingAsset = await this.managementClient.viewAsset().byAssetExternalId(assetExternalId).toPromise();
            } catch (error) {
                let throwError = true;

                if (error instanceof SharedModels.ContentManagementBaseKontentError) {
                    if (error.originalError?.response?.status === 404) {
                        throwError = false;
                    }
                }

                if (throwError) {
                    throw error;
                }
            }

            if (!existingAsset) {
                // only import asset if it wasn't already there
                const uploadedBinaryFile = await this.managementClient
                    .uploadBinaryFile()
                    .withData({
                        binaryData: asset.binaryData,
                        contentType: asset.mimeType ?? '',
                        filename: asset.filename
                    })
                    .toPromise();

                this.logItem(importedItems, 'upload', 'binaryFile', {
                    imported: uploadedBinaryFile,
                    original: asset,
                    title: asset.filename,
                    importedId: undefined,
                    originalId: undefined
                });

                const createdAsset = await this.managementClient
                    .addAsset()
                    .withData((builder) => {
                        return {
                            file_reference: {
                                id: uploadedBinaryFile.data.id,
                                type: 'internal'
                            },
                            external_id: assetExternalId
                        };
                    })
                    .toPromise();

                this.logItem(importedItems, 'create', 'asset', {
                    imported: createdAsset,
                    original: asset,
                    title: asset.filename,
                    importedId: createdAsset.data.id,
                    originalId: asset.assetId
                });
            } else {
                this.logItem(importedItems, 'fetch', 'asset', {
                    imported: existingAsset,
                    original: asset,
                    title: asset.filename,
                    importedId: existingAsset.data.id,
                    originalId: asset.assetId
                });
                this.logItem(importedItems, 'skipUpdate', 'asset', {
                    imported: existingAsset,
                    original: asset,
                    title: asset.filename,
                    importedId: existingAsset.data.id,
                    originalId: asset.assetId
                });
            }
        }

        return importedItems;
    }

    private async importContentItemsAsync(
        importContentItems: IParsedContentItem[],
        importedItems: IImportItemResult[]
    ): Promise<{
        importedItems: ContentItemModels.ContentItem[];
        importedLanguageVariants: LanguageVariantModels.ContentItemLanguageVariant[];
    }> {
        const preparedItems: ContentItemModels.ContentItem[] = [];
        const upsertedLanguageVariants: LanguageVariantModels.ContentItemLanguageVariant[] = [];

        const workflows = await this.getWorkflowsAsync();
        const collections = await this.getCollectionsAsync();

        // first process content items
        for (const importContentItem of importContentItems) {
            try {
                if (!importContentItem.workflow_step) {
                    continue;
                }

                const preparedContentItem: ContentItemModels.ContentItem = await this.prepareContentItemForImportAsync(
                    importContentItem,
                    importedItems
                );
                preparedItems.push(preparedContentItem);

                // check if name should be updated, no other changes are supported
                if (this.shouldUpdateContentItem(importContentItem, preparedContentItem, collections)) {
                    const upsertedContentItem = await this.managementClient
                        .upsertContentItem()
                        .byItemCodename(importContentItem.codename)
                        .withData({
                            name: importContentItem.name,
                            collection: {
                                codename: importContentItem.collection
                            }
                        })
                        .toPromise()
                        .then((m) => m.data);

                    this.logItem(importedItems, 'upsert', 'contentItem', {
                        title: `${importContentItem.name}`,
                        imported: importContentItem,
                        importedId: upsertedContentItem.id,
                        originalCodename: importContentItem.codename,
                        originalId: undefined,
                        original: importContentItem
                    });
                } else {
                    this.logItem(importedItems, 'skipUpdate', 'contentItem', {
                        title: `${importContentItem.name}`,
                        imported: importContentItem,
                        importedId: preparedContentItem.id,
                        originalCodename: importContentItem.codename,
                        originalId: undefined,
                        original: importContentItem
                    });
                }
            } catch (error) {
                if (this.config.skipFailedItems) {
                    let errorMessage: any;

                    if (error instanceof SharedModels.ContentManagementBaseKontentError) {
                        errorMessage = error.message;
                    } else if (error instanceof Error) {
                        errorMessage = error.message;
                    } else {
                        errorMessage = error;
                    }

                    logDebug('error', `Failed to import content item`, importContentItem.codename, errorMessage);
                } else {
                    throw error;
                }
            }
        }

        // then process language variants
        for (const importContentItem of importContentItems) {
            try {
                // if content item does not have a workflow step it means it is used as a component within Rich text element
                // such items are procesed within element transform
                if (!importContentItem.workflow_step) {
                    continue;
                }

                const upsertedContentItem = preparedItems.find((m) => m.codename === importContentItem.codename);

                if (!upsertedContentItem) {
                    throw Error(`Invalid content item for codename '${importContentItem.codename}'`);
                }

                await this.prepareLanguageVariantForImportAsync(importContentItem, workflows, importedItems);

                const upsertedLanguageVariant = await this.managementClient
                    .upsertLanguageVariant()
                    .byItemCodename(upsertedContentItem.codename)
                    .byLanguageCodename(importContentItem.language)
                    .withData((builder) => {
                        return {
                            elements: importContentItem.elements.map((m) =>
                                this.getElementContract(importContentItems, m, importedItems)
                            )
                        };
                    })
                    .toPromise();

                upsertedLanguageVariants.push(upsertedLanguageVariant.data);

                this.logItem(importedItems, 'upsert', 'languageVariant', {
                    title: `${upsertedContentItem.name}`,
                    language: importContentItem.language,
                    imported: upsertedLanguageVariants,
                    importedId: upsertedContentItem.id,
                    originalCodename: importContentItem.codename,
                    originalId: undefined,
                    original: importContentItem
                });

                // set workflow of language variant
                if (importContentItem.workflow_step) {
                    if (
                        this.doesWorkflowStepCodenameRepresentPublishedStep(importContentItem.workflow_step, workflows)
                    ) {
                        await this.managementClient
                            .publishLanguageVariant()
                            .byItemCodename(importContentItem.codename)
                            .byLanguageCodename(importContentItem.language)
                            .withoutData()
                            .toPromise();

                        this.logItem(importedItems, 'publish', 'languageVariant', {
                            title: `${upsertedContentItem.name}`,
                            imported: upsertedLanguageVariants,
                            workflowStep: importContentItem.workflow_step,
                            language: importContentItem.language,
                            importedId: upsertedContentItem.id,
                            originalCodename: importContentItem.codename,
                            originalId: undefined,
                            original: importContentItem
                        });
                    } else if (
                        this.doesWorkflowStepCodenameRepresentArchivedStep(importContentItem.workflow_step, workflows)
                    ) {
                        const workflow = this.getWorkflowForGivenStepByCodename(
                            importContentItem.workflow_step,
                            workflows
                        );

                        await this.managementClient
                            .changeWorkflowOfLanguageVariant()
                            .byItemCodename(importContentItem.codename)
                            .byLanguageCodename(importContentItem.language)
                            .withData({
                                step_identifier: {
                                    codename: workflow.archivedStep.codename
                                },
                                workflow_identifier: {
                                    codename: workflow.codename
                                }
                            })
                            .toPromise();

                        this.logItem(importedItems, 'archive', 'languageVariant', {
                            title: `${upsertedContentItem.name}`,
                            imported: upsertedLanguageVariants,
                            workflowStep: importContentItem.workflow_step,
                            language: importContentItem.language,
                            importedId: upsertedContentItem.id,
                            originalCodename: importContentItem.codename,
                            originalId: undefined,
                            original: importContentItem
                        });
                    } else {
                        const workflow = this.getWorkflowForGivenStepByCodename(
                            importContentItem.workflow_step,
                            workflows
                        );

                        await this.managementClient
                            .changeWorkflowOfLanguageVariant()
                            .byItemCodename(importContentItem.codename)
                            .byLanguageCodename(importContentItem.language)
                            .withData({
                                step_identifier: {
                                    codename: importContentItem.workflow_step
                                },
                                workflow_identifier: {
                                    codename: workflow.codename
                                }
                            })
                            .toPromise();

                        this.logItem(importedItems, 'changeWorkflowStep', 'languageVariant', {
                            title: `${upsertedContentItem.name}`,
                            imported: upsertedLanguageVariants,
                            workflowStep: importContentItem.workflow_step,
                            language: importContentItem.language,
                            importedId: upsertedContentItem.id,
                            originalCodename: importContentItem.codename,
                            originalId: undefined,
                            original: importContentItem
                        });
                    }
                }
            } catch (error) {
                if (this.config.skipFailedItems) {
                    let errorMessage: any;

                    if (error instanceof SharedModels.ContentManagementBaseKontentError) {
                        errorMessage = error.message;
                    } else if (error instanceof Error) {
                        errorMessage = error.message;
                    } else {
                        errorMessage = error;
                    }

                    logDebug(
                        'error',
                        ` Failed to import language variant '${importContentItem.language}'`,
                        importContentItem.codename,
                        errorMessage
                    );
                } else {
                    throw error;
                }
            }
        }

        return {
            importedItems: preparedItems,
            importedLanguageVariants: upsertedLanguageVariants
        };
    }

    private getWorkflowForGivenStepByCodename(
        itemWorkflowCodename: string,
        workflows: WorkflowModels.Workflow[]
    ): WorkflowModels.Workflow {
        for (const workflow of workflows) {
            if (workflow.archivedStep.codename === itemWorkflowCodename) {
                return workflow;
            }
            if (workflow.publishedStep.codename === itemWorkflowCodename) {
                return workflow;
            }
            const step = workflow.steps.find((m) => m.codename === itemWorkflowCodename);

            if (step) {
                return workflow;
            }
        }

        const defaultWorkflow = workflows.find(
            (m) => m.codename.toLowerCase() === defaultWorkflowCodename.toLowerCase()
        );

        if (!defaultWorkflow) {
            throw Error(`Missing default workflow`);
        }

        return defaultWorkflow;
    }

    private getWorkflowForGivenStepById(
        workflowId: string,
        workflows: WorkflowModels.Workflow[]
    ): WorkflowModels.Workflow {
        for (const workflow of workflows) {
            if (workflow.archivedStep.id === workflowId) {
                return workflow;
            }
            if (workflow.publishedStep.id === workflowId) {
                return workflow;
            }
            const step = workflow.steps.find((m) => m.id === workflowId);

            if (step) {
                return workflow;
            }
        }

        const defaultWorkflow = workflows.find(
            (m) => m.codename.toLowerCase() === defaultWorkflowCodename.toLowerCase()
        );

        if (!defaultWorkflow) {
            throw Error(`Missing default workflow`);
        }

        return defaultWorkflow;
    }

    private async prepareContentItemForImportAsync(
        importContentItem: IParsedContentItem,
        importedItems: IImportItemResult[]
    ): Promise<ContentItemModels.ContentItem> {
        try {
            const contentItem = await this.managementClient
                .viewContentItem()
                .byItemCodename(importContentItem.codename)
                .toPromise()
                .then((m) => m.data);

            this.logItem(importedItems, 'fetch', 'contentItem', {
                title: `${contentItem.name}`,
                imported: contentItem,
                importedId: contentItem.id,
                originalCodename: contentItem.codename,
                originalId: undefined,
                original: contentItem
            });

            return contentItem;
        } catch (error) {
            if (error instanceof SharedModels.ContentManagementBaseKontentError) {
                if (error.originalError?.response?.status === 404) {
                    const contentItem = await this.managementClient
                        .addContentItem()
                        .withData({
                            name: importContentItem.name,
                            type: {
                                codename: importContentItem.type
                            },
                            codename: importContentItem.codename,
                            collection: {
                                codename: importContentItem.collection
                            }
                        })
                        .toPromise()
                        .then((m) => m.data);

                    this.logItem(importedItems, 'create', 'contentItem', {
                        title: `${contentItem.name}`,
                        imported: contentItem,
                        importedId: contentItem.id,
                        originalCodename: contentItem.codename,
                        originalId: undefined,
                        original: contentItem
                    });

                    return contentItem;
                }
            }

            throw error;
        }
    }

    private async prepareLanguageVariantForImportAsync(
        importContentItem: IParsedContentItem,
        workflows: WorkflowModels.Workflow[],
        importItems: IImportItemResult[]
    ): Promise<void> {
        let languageVariantOfContentItem: undefined | LanguageVariantModels.ContentItemLanguageVariant;

        try {
            languageVariantOfContentItem = await this.managementClient
                .viewLanguageVariant()
                .byItemCodename(importContentItem.codename)
                .byLanguageCodename(importContentItem.language)
                .toPromise()
                .then((m) => m.data);

            this.logItem(importItems, 'fetch', 'languageVariant', {
                title: `${importContentItem.name}`,
                imported: languageVariantOfContentItem,
                original: importContentItem,
                language: importContentItem.language
            });
        } catch (error) {
            let throwError: boolean = true;

            if (error instanceof SharedModels.ContentManagementBaseKontentError) {
                if (error.originalError?.response?.status === 404) {
                    throwError = false;
                }
            }

            if (throwError) {
                throw error;
            }
        }

        if (languageVariantOfContentItem) {
            // language variant exists
            // check if variant is published or archived
            if (this.isLanguageVariantPublished(languageVariantOfContentItem, workflows)) {
                // create new version
                await this.managementClient
                    .createNewVersionOfLanguageVariant()
                    .byItemCodename(importContentItem.codename)
                    .byLanguageCodename(importContentItem.language)
                    .toPromise();

                this.logItem(importItems, 'createNewVersion', 'languageVariant', {
                    title: `${importContentItem.name}`,
                    imported: languageVariantOfContentItem,
                    original: importContentItem,
                    language: importContentItem.language
                });
            } else if (this.isLanguageVariantArchived(languageVariantOfContentItem, workflows)) {
                // change workflow step to draft
                if (languageVariantOfContentItem.workflow.stepIdentifier.id) {
                    const workflow = this.getWorkflowForGivenStepById(
                        languageVariantOfContentItem.workflow.stepIdentifier.id,
                        workflows
                    );
                    const newWorkflowStep = workflow.steps[0];

                    await this.managementClient
                        .changeWorkflowStepOfLanguageVariant()
                        .byItemCodename(importContentItem.codename)
                        .byLanguageCodename(importContentItem.language)
                        .byWorkflowStepCodename(newWorkflowStep.codename)
                        .toPromise();

                    this.logItem(importItems, 'unArchive', 'languageVariant', {
                        title: `${importContentItem.name}`,
                        imported: languageVariantOfContentItem,
                        original: importContentItem,
                        language: importContentItem.language,
                        workflowStep: newWorkflowStep.codename
                    });
                }
            }
        }
    }

    private async getWorkflowsAsync(): Promise<WorkflowModels.Workflow[]> {
        return await this.managementClient
            .listWorkflows()
            .toPromise()
            .then((m) => m.data);
    }

    private async getCollectionsAsync(): Promise<CollectionModels.Collection[]> {
        return await this.managementClient
            .listCollections()
            .toPromise()
            .then((m) => m.data.collections);
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

    private handleImportError(error: any | SharedModels.ContentManagementBaseKontentError): void {
        handleError(error);
    }

    private logItem(
        importedItems: IImportItemResult[],
        actionType: ActionType,
        itemType: ItemType,
        data: {
            language?: string;
            workflowStep?: string;
            title: string;
            originalId?: string;
            originalCodename?: string;
            importedId?: string;
            imported: any;
            original: any;
        }
    ): void {
        importedItems.push({
            imported: data.imported,
            original: data.original,
            importId: data.importedId,
            originalId: data.originalId,
            originalCodename: data.originalCodename
        });

        if (actionType === 'fetch') {
            return;
        }

        logDebug(actionType, data.title, itemType, data.language, data.workflowStep);
    }

    private getElementContract(
        sourceItems: IParsedContentItem[],
        element: IParsedElement,
        importItems: IImportItemResult[]
    ): ElementContracts.IContentItemElementContract {
        const importContract = translationHelper.transformToImportValue(
            element.value,
            element.codename,
            element.type,
            importItems,
            sourceItems
        );

        if (!importContract) {
            throw Error(`Missing import contract for element `);
        }

        return importContract;
    }

    private shouldUpdateContentItem(
        importContentItem: IParsedContentItem,
        item: ContentItemModels.ContentItem,
        collections: CollectionModels.Collection[]
    ): boolean {
        const collection = collections.find((m) => m.codename === importContentItem.collection);

        if (!collection) {
            throw Error(`Invalid collection '${importContentItem.collection}'`);
        }
        return importContentItem.name !== item.name || importContentItem.collection !== collection.codename;
    }
}
