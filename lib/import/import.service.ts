import {
    AssetModels,
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
    IImportedData,
    ActionType,
    handleError,
    defaultRetryStrategy,
    printProjectAndEnvironmentInfoToConsoleAsync,
    translationHelper,
    ItemType,
    defaultWorkflowCodename,
    is404Error,
    extractErrorMessage
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

    async importFromSourceAsync(sourceData: IImportSource): Promise<IImportedData> {
        return await this.importAsync(sourceData);
    }

    async importAsync(sourceData: IImportSource): Promise<IImportedData> {
        const importedData: IImportedData = {
            assets: [],
            contentItems: [],
            languageVariants: []
        };
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
                await this.importAssetsAsync(dataToImport.importData.assets, importedData);
            } else {
                logDebug('info', `There are no assets to import`);
            }

            // Content items
            if (dataToImport.importData.items.length) {
                logDebug('info', `Importing content items`);
                await this.importContentDataAsync(dataToImport.importData.items, importedData);
            } else {
                logDebug('info', `There are no content items to import`);
            }

            logDebug('info', `Finished import`);
        } catch (error) {
            this.handleImportError(error);
        }
        return importedData;
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

    private async importAssetsAsync(assets: IImportAsset[], importedData: IImportedData): Promise<void> {
        for (const asset of assets) {
            // use asset id as external id
            const assetExternalId: string = asset.assetId;

            // check if asset with given external id already exists
            let existingAsset: AssetModels.Asset | undefined;

            try {
                // when target project is the same as source project, the id of asset would be the same
                // and such asset should not be imported again
                existingAsset = await this.managementClient
                    .viewAsset()
                    .byAssetExternalId(asset.assetId)
                    .toPromise()
                    .then((m) => m.data);
            } catch (error) {
                if (!is404Error(error)) {
                    throw error;
                }
            }

            try {
                // check if asset with given external id was already created
                existingAsset = await this.managementClient
                    .viewAsset()
                    .byAssetExternalId(assetExternalId)
                    .toPromise()
                    .then((m) => m.data);
            } catch (error) {
                if (!is404Error(error)) {
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

                this.logAction('upload', 'binaryFile', {
                    title: asset.filename
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
                    .toPromise()
                    .then((m) => m.data);

                importedData.assets.push({
                    imported: createdAsset,
                    original: asset
                });

                this.logAction('create', 'asset', {
                    title: asset.filename
                });
            } else {
                importedData.assets.push({
                    imported: existingAsset,
                    original: asset
                });
                this.logAction('skipUpdate', 'asset', {
                    title: asset.filename
                });
            }
        }
    }

    private async importContentDataAsync(
        importContentItems: IParsedContentItem[],
        importedData: IImportedData
    ): Promise<void> {
        const workflows = await this.getWorkflowsAsync();
        const collections = await this.getCollectionsAsync();

        // first prepare content items
        const preparedContentItems: ContentItemModels.ContentItem[] = await this.importContentItemsAsync(
            importContentItems,
            collections,
            importedData
        );

        // then process language variants
        await this.importLanguageVariantsAsync(importContentItems, workflows, preparedContentItems, importedData);
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

    private async setWorkflowOfLanguageVariantAsync(
        workflowStepCodename: string,
        importContentItem: IParsedContentItem,
        workflows: WorkflowModels.Workflow[]
    ): Promise<void> {
        if (this.doesWorkflowStepCodenameRepresentPublishedStep(workflowStepCodename, workflows)) {
            await this.managementClient
                .publishLanguageVariant()
                .byItemCodename(importContentItem.codename)
                .byLanguageCodename(importContentItem.language)
                .withoutData()
                .toPromise();

            this.logAction('publish', 'languageVariant', {
                title: `${importContentItem.name}`,
                workflowStep: importContentItem.workflow_step,
                language: importContentItem.language
            });
        } else if (this.doesWorkflowStepCodenameRepresentArchivedStep(workflowStepCodename, workflows)) {
            const workflow = this.getWorkflowForGivenStepByCodename(workflowStepCodename, workflows);

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

            this.logAction('archive', 'languageVariant', {
                title: `${importContentItem.name}`,
                workflowStep: importContentItem.workflow_step,
                language: importContentItem.language
            });
        } else {
            const workflow = this.getWorkflowForGivenStepByCodename(workflowStepCodename, workflows);

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

            this.logAction('changeWorkflowStep', 'languageVariant', {
                title: `${importContentItem.name}`,
                workflowStep: importContentItem.workflow_step,
                language: importContentItem.language
            });
        }
    }

    private async importLanguageVariantsAsync(
        importContentItems: IParsedContentItem[],
        workflows: WorkflowModels.Workflow[],
        preparedContentItems: ContentItemModels.ContentItem[],
        importedData: IImportedData
    ): Promise<void> {
        for (const importContentItem of importContentItems) {
            try {
                // if content item does not have a workflow step it means it is used as a component within Rich text element
                // such items are procesed within element transform
                if (!importContentItem.workflow_step) {
                    continue;
                }

                const upsertedContentItem = preparedContentItems.find((m) => m.codename === importContentItem.codename);

                if (!upsertedContentItem) {
                    throw Error(`Invalid content item for codename '${importContentItem.codename}'`);
                }

                await this.prepareLanguageVariantForImportAsync(importContentItem, workflows);

                const upsertedLanguageVariant = await this.managementClient
                    .upsertLanguageVariant()
                    .byItemCodename(upsertedContentItem.codename)
                    .byLanguageCodename(importContentItem.language)
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

                this.logAction('upsert', 'languageVariant', {
                    title: `${upsertedContentItem.name}`,
                    language: importContentItem.language
                });

                // set workflow of language variant
                if (importContentItem.workflow_step) {
                    await this.setWorkflowOfLanguageVariantAsync(
                        importContentItem.workflow_step,
                        importContentItem,
                        workflows
                    );
                }
            } catch (error) {
                if (this.config.skipFailedItems) {
                    logDebug(
                        'error',
                        ` Failed to import language variant '${importContentItem.language}'`,
                        importContentItem.codename,
                        extractErrorMessage(error)
                    );
                } else {
                    throw error;
                }
            }
        }
    }

    private async importContentItemsAsync(
        importContentItems: IParsedContentItem[],
        collections: CollectionModels.Collection[],
        importedData: IImportedData
    ): Promise<ContentItemModels.ContentItem[]> {
        const preparedItems: ContentItemModels.ContentItem[] = [];
        for (const importContentItem of importContentItems) {
            try {
                if (!importContentItem.workflow_step) {
                    continue;
                }

                const preparedContentItem: ContentItemModels.ContentItem = await this.prepareContentItemAsync(
                    importContentItem,
                    importedData
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

                    this.logAction('upsert', 'contentItem', {
                        title: `${upsertedContentItem.name}`
                    });
                } else {
                    this.logAction('skipUpdate', 'contentItem', {
                        title: `${importContentItem.name}`
                    });
                }
            } catch (error) {
                if (this.config.skipFailedItems) {
                    logDebug(
                        'error',
                        `Failed to import content item`,
                        importContentItem.codename,
                        extractErrorMessage(error)
                    );
                } else {
                    throw error;
                }
            }
        }

        return preparedItems;
    }

    private async prepareContentItemAsync(
        importContentItem: IParsedContentItem,
        importedData: IImportedData
    ): Promise<ContentItemModels.ContentItem> {
        try {
            const contentItem = await this.managementClient
                .viewContentItem()
                .byItemCodename(importContentItem.codename)
                .toPromise()
                .then((m) => m.data);

            this.logAction('fetch', 'contentItem', {
                title: `${contentItem.name}`
            });

            importedData.contentItems.push({
                original: importContentItem,
                imported: contentItem
            });

            return contentItem;
        } catch (error) {
            if (is404Error(error)) {
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

                importedData.contentItems.push({
                    original: importContentItem,
                    imported: contentItem
                });

                this.logAction('create', 'contentItem', {
                    title: `${contentItem.name}`
                });

                return contentItem;
            }

            throw error;
        }
    }

    private async prepareLanguageVariantForImportAsync(
        importContentItem: IParsedContentItem,
        workflows: WorkflowModels.Workflow[]
    ): Promise<void> {
        let languageVariantOfContentItem: undefined | LanguageVariantModels.ContentItemLanguageVariant;

        try {
            languageVariantOfContentItem = await this.managementClient
                .viewLanguageVariant()
                .byItemCodename(importContentItem.codename)
                .byLanguageCodename(importContentItem.language)
                .toPromise()
                .then((m) => m.data);

            this.logAction('fetch', 'languageVariant', {
                title: `${importContentItem.name}`,
                language: importContentItem.language
            });

            if (!languageVariantOfContentItem) {
                throw Error(
                    `Invalid langauge variant for item '${importContentItem.codename}' of type '${importContentItem.type}' and language '${importContentItem.language}'`
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
                await this.managementClient
                    .createNewVersionOfLanguageVariant()
                    .byItemCodename(importContentItem.codename)
                    .byLanguageCodename(importContentItem.language)
                    .toPromise();

                this.logAction('createNewVersion', 'languageVariant', {
                    title: `${importContentItem.name}`,
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

                    this.logAction('unArchive', 'languageVariant', {
                        title: `${importContentItem.name}`,
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

    private logAction(
        actionType: ActionType,
        itemType: ItemType,
        data: {
            language?: string;
            workflowStep?: string;
            title: string;
        }
    ): void {
        logDebug(actionType, data.title, itemType, data.language, data.workflowStep);
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
