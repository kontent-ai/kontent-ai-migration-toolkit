import {
    AssetFolderContracts,
    AssetFolderModels,
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
    printProjectInfoToConsoleAsync,
    translationHelper,
    ItemType,
    defaultWorkflowCodename
} from '../core';
import {
    IImportAsset,
    IImportConfig,
    IImportContentItem,
    IImportContentItemElement,
    IImportSource
} from './import.models';
import { HttpService } from '@kontent-ai/core-sdk';
import { magenta, yellow } from 'colors';

export class ImportService {
    private readonly client: ManagementClient;

    /**
     * Maximum allowed size of asset in Bytes.
     * Currently 1e8 = 100 MB
     */
    // private readonly maxAllowedAssetSizeInBytes: number = 1e8;

    constructor(private config: IImportConfig) {
        this.client = new ManagementClient({
            apiKey: config.apiKey,
            baseUrl: config.baseUrl,
            projectId: config.projectId,
            httpService: new HttpService({
                logErrorsToConsole: false
            }),
            retryStrategy: config.retryStrategy ?? defaultRetryStrategy
        });
    }

    public async importFromSourceAsync(sourceData: IImportSource): Promise<IImportItemResult[]> {
        return await this.importAsync(sourceData);
    }

    public async importAsync(sourceData: IImportSource): Promise<IImportItemResult[]> {
        const importedItems: IImportItemResult[] = [];
        await printProjectInfoToConsoleAsync(this.client);

        // log information regarding version mismatch
        if (version !== sourceData.metadata.csvManagerVersion) {
            console.warn(
                `WARNING: Version mismatch. Current version of '${name}' is '${version}', but package was created in version '${sourceData.metadata.csvManagerVersion}'.`
            );
            console.warn(
                `Import may still succeed, but if it doesn't, please try using '${sourceData.metadata.csvManagerVersion}' version of this library. `
            );
        }

        // this is an optional step where users can exclude certain objects from being
        // imported via import configuration.
        // this has to be done before translating ids
        console.log(`Removing skipped items`);
        this.removeSkippedItemsFromImport(sourceData);

        // import order matters

        try {
            // ### Assets
            if (sourceData.importData.assets.length) {
                console.log(`Importing assets`);
                const importedAssets = await this.importAssetsAsync(sourceData.importData.assets);
                importedItems.push(...importedAssets);
            } else {
                console.log(`Skipping assets`);
            }

            // ### Content items

            if (sourceData.importData.items.length) {
                console.log(`Importing content items`);
                await this.importContentItemsAsync(sourceData.importData.items, importedItems);
            }

            console.log(`Finished import`);
        } catch (error) {
            this.handleImportError(error);
        }
        return importedItems;
    }

    private removeSkippedItemsFromImport(source: IImportSource): void {
        if (this.config.canImport && this.config.canImport.contentItem) {
            for (const item of source.importData.items) {
                const shouldImport = this.config.canImport.contentItem(item);
                if (!shouldImport) {
                    source.importData.items = source.importData.items.filter((m) => m.codename !== item.codename);
                }
            }
        }
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
                existingAsset = await this.client.viewAsset().byAssetExternalId(asset.assetId).toPromise();
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
                existingAsset = await this.client.viewAsset().byAssetExternalId(assetExternalId).toPromise();
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
                const uploadedBinaryFile = await this.client
                    .uploadBinaryFile()
                    .withData({
                        binaryData: asset.binaryData,
                        contentType: asset.mimeType ?? '',
                        filename: asset.filename
                    })
                    .toPromise();

                this.processItem(importedItems, 'upload', 'binaryFile', {
                    imported: uploadedBinaryFile,
                    original: asset,
                    title: asset.filename,
                    importedId: undefined,
                    originalId: undefined
                });

                const createdAsset = await this.client
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

                this.processItem(importedItems, 'create', 'asset', {
                    imported: createdAsset,
                    original: asset,
                    title: asset.filename,
                    importedId: createdAsset.data.id,
                    originalId: asset.assetId
                });
            } else {
                this.processItem(importedItems, 'fetch', 'asset', {
                    imported: existingAsset,
                    original: asset,
                    title: asset.filename,
                    importedId: existingAsset.data.id,
                    originalId: asset.assetId
                });
                this.processItem(importedItems, 'skipUpdate', 'asset', {
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
        importContentItems: IImportContentItem[],
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
                const upsertedContentItem = (
                    await this.client
                        .upsertContentItem()
                        .byItemCodename(importContentItem.codename)
                        .withData({
                            name: importContentItem.name,
                            collection: {
                                codename: importContentItem.collection
                            }
                        })
                        .toPromise()
                ).data;

                this.processItem(importedItems, 'upsert', 'contentItem', {
                    title: `${importContentItem.name}`,
                    imported: importContentItem,
                    importedId: upsertedContentItem.id,
                    originalCodename: importContentItem.codename,
                    originalId: undefined,
                    original: importContentItem
                });
            } else {
                this.processItem(importedItems, 'skipUpdate', 'contentItem', {
                    title: `${importContentItem.name}`,
                    imported: importContentItem,
                    importedId: preparedContentItem.id,
                    originalCodename: importContentItem.codename,
                    originalId: undefined,
                    original: importContentItem
                });
            }
        }

        // then process language variants
        for (const importContentItem of importContentItems) {
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

            const upsertedLanguageVariant = await this.client
                .upsertLanguageVariant()
                .byItemCodename(upsertedContentItem.codename)
                .byLanguageCodename(importContentItem.language)
                .withData(() => {
                    return importContentItem.elements.map((m) =>
                        this.getElementContract(importContentItems, m, importedItems)
                    );
                })
                .toPromise();

            upsertedLanguageVariants.push(upsertedLanguageVariant.data);

            this.processItem(importedItems, 'upsert', 'languageVariant', {
                title: `${upsertedContentItem.name} (${magenta(importContentItem.language)})`,
                imported: upsertedLanguageVariants,
                importedId: upsertedContentItem.id,
                originalCodename: importContentItem.codename,
                originalId: undefined,
                original: importContentItem
            });

            // set workflow of language variant
            if (importContentItem.workflow_step) {
                if (this.doesWorkflowStepCodenameRepresentPublishedStep(importContentItem.workflow_step, workflows)) {
                    await this.client
                        .publishLanguageVariant()
                        .byItemCodename(importContentItem.codename)
                        .byLanguageCodename(importContentItem.language)
                        .withoutData()
                        .toPromise();

                    this.processItem(importedItems, 'publish', 'languageVariant', {
                        title: `${upsertedContentItem.name} (${magenta(importContentItem.language)}) (${yellow(
                            importContentItem.workflow_step
                        )})`,
                        imported: upsertedLanguageVariants,
                        importedId: upsertedContentItem.id,
                        originalCodename: importContentItem.codename,
                        originalId: undefined,
                        original: importContentItem
                    });
                } else if (
                    this.doesWorkflowStepCodenameRepresentArchivedStep(importContentItem.workflow_step, workflows)
                ) {
                    const workflow = this.getWorkflowForGivenStep(importContentItem.workflow_step, workflows);

                    await this.client
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

                    this.processItem(importedItems, 'archive', 'languageVariant', {
                        title: `${upsertedContentItem.name} (${magenta(importContentItem.language)}) (${yellow(
                            importContentItem.workflow_step
                        )})`,
                        imported: upsertedLanguageVariants,
                        importedId: upsertedContentItem.id,
                        originalCodename: importContentItem.codename,
                        originalId: undefined,
                        original: importContentItem
                    });
                } else {
                    const workflow = this.getWorkflowForGivenStep(importContentItem.workflow_step, workflows);

                    await this.client
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

                    this.processItem(importedItems, 'changeWorkflowStep', 'languageVariant', {
                        title: `${upsertedContentItem.name} (${magenta(importContentItem.language)} (${yellow(
                            importContentItem.workflow_step
                        )})`,
                        imported: upsertedLanguageVariants,
                        importedId: upsertedContentItem.id,
                        originalCodename: importContentItem.codename,
                        originalId: undefined,
                        original: importContentItem
                    });
                }
            }
        }

        return {
            importedItems: preparedItems,
            importedLanguageVariants: upsertedLanguageVariants
        };
    }

    private getWorkflowForGivenStep(
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

    private async prepareContentItemForImportAsync(
        importContentItem: IImportContentItem,
        importedItems: IImportItemResult[]
    ): Promise<ContentItemModels.ContentItem> {
        try {
            const contentItem = (
                await this.client.viewContentItem().byItemCodename(importContentItem.codename).toPromise()
            ).data;

            this.processItem(importedItems, 'fetch', 'contentItem', {
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
                    const contentItem = (
                        await this.client
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
                    ).data;

                    this.processItem(importedItems, 'create', 'contentItem', {
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
        importContentItem: IImportContentItem,
        workflows: WorkflowModels.Workflow[],
        importItems: IImportItemResult[]
    ): Promise<void> {
        let languageVariantOfContentItem: undefined | LanguageVariantModels.ContentItemLanguageVariant;

        try {
            languageVariantOfContentItem = (
                await this.client
                    .viewLanguageVariant()
                    .byItemCodename(importContentItem.codename)
                    .byLanguageCodename(importContentItem.language)
                    .toPromise()
            ).data;

            this.processItem(importItems, 'fetch', 'languageVariant', {
                title: `${importContentItem.name} (${magenta(importContentItem.language)})`,
                imported: languageVariantOfContentItem,
                original: importContentItem
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
            // check if variant is published or not
            if (this.isLanguageVariantPublished(languageVariantOfContentItem, workflows)) {
                // create new version
                await this.client
                    .createNewVersionOfLanguageVariant()
                    .byItemCodename(importContentItem.codename)
                    .byLanguageCodename(importContentItem.language)
                    .toPromise();

                this.processItem(importItems, 'createNewVersion', 'languageVariant', {
                    title: `${importContentItem.name} (${magenta(importContentItem.language)})`,
                    imported: languageVariantOfContentItem,
                    original: importContentItem
                });
            }
        }
    }

    private async getWorkflowsAsync(): Promise<WorkflowModels.Workflow[]> {
        return (await this.client.listWorkflows().toPromise()).data;
    }

    private async getCollectionsAsync(): Promise<CollectionModels.Collection[]> {
        return (await this.client.listCollections().toPromise()).data.collections;
    }

    private isLanguageVariantPublished(
        languageVariant: LanguageVariantModels.ContentItemLanguageVariant,
        workflows: WorkflowModels.Workflow[]
    ): boolean {
        for (const workflow of workflows) {
            if (workflow.publishedStep.id === languageVariant.workflowStep.id) {
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
        console.log(error);
        handleError(error);
    }

    private processItem(
        importedItems: IImportItemResult[],
        actionType: ActionType,
        itemType: ItemType,
        data: {
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

        if (!this.config.onImport) {
            return;
        }

        this.config.onImport({
            data: data.imported,
            title: data.title,
            actionType,
            itemType
        });
    }

    private mapAssetFolder(
        folder: AssetFolderContracts.IAssetFolderContract
    ): AssetFolderModels.IAddOrModifyAssetFolderData {
        return {
            name: folder.name,
            external_id: folder.external_id,
            folders: folder.folders?.map((m) => this.mapAssetFolder(m)) ?? []
        };
    }

    private getElementContract(
        sourceItems: IImportContentItem[],
        element: IImportContentItemElement,
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
        importContentItem: IImportContentItem,
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
