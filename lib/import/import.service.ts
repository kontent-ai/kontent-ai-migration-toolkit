import {
    AssetFolderContracts,
    AssetFolderModels,
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
    ItemType
} from '../core';
import { IImportConfig, IImportContentItem, IImportContentItemElement, IImportSource } from './import.models';
import { HttpService } from '@kontent-ai/core-sdk';
import { magenta } from 'colors';

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
        if (this.config.enableLog) {
            console.log(`Removing skipped items`);
        }
        this.removeSkippedItemsFromImport(sourceData);

        if (this.config.enableLog) {
            console.log(`Importing data`);
        }

        // import order matters

        try {
            // ### Assets
            if (sourceData.importData.assets.length) {
                // const importedAssets = await this.importAssetsAsync(
                //     sourceData.importData.assets,
                //     sourceData.binaryFiles,
                //     importedItems
                // );
                // importedItems.push(...importedAssets);
            } else {
                if (this.config.enableLog) {
                    console.log(`Skipping assets`);
                }
            }

            // ### Content items
            if (sourceData.importData.items.length) {
                await this.importContentItemsAsync(sourceData.importData.items, importedItems);
            }

            if (this.config.enableLog) {
                console.log(`Finished importing data`);
            }
        } catch (error) {
            this.handleImportError(error);
        }
        return importedItems;
    }

    private removeSkippedItemsFromImport(source: IImportSource): void {
        if (this.config.canImport && this.config.canImport.asset) {
            for (const item of source.importData.assets) {
                const shouldImport = this.config.canImport.asset(item);
                if (!shouldImport) {
                    source.importData.assets = source.importData.assets.filter((m) => m.assetId !== item.assetId);
                }
            }
        }

        if (this.config.canImport && this.config.canImport.contentItem) {
            for (const item of source.importData.items) {
                const shouldImport = this.config.canImport.contentItem(item);
                if (!shouldImport) {
                    source.importData.items = source.importData.items.filter((m) => m.codename !== item.codename);
                }
            }
        }
    }

    // private async importAssetsAsync(
    //     assets: AssetContracts.IAssetModelContract[],
    //     binaryFiles: IBinaryFile[],
    //     currentItems: IImportItemResult[]
    // ): Promise<IImportItemResult[]> {
    //     const importedItems: IImportItemResult[] = [];
    //     const unsupportedBinaryFiles: IBinaryFile[] = [];

    //     for (const asset of assets) {
    //         const binaryFile = binaryFiles.find((m) => m.asset.id === asset.id);

    //         if (!binaryFile) {
    //             throw Error(`Could not find binary file for asset with id '${asset.id}'`);
    //         }

    //         let binaryDataToUpload: any = binaryFile.binaryData;
    //         if (binaryFile.asset.size >= this.maxAllowedAssetSizeInBytes) {
    //             if (this.config.onUnsupportedBinaryFile) {
    //                 this.config.onUnsupportedBinaryFile(binaryFile);
    //             }
    //             console.log(
    //                 `Removing binary data from file due to size. Max. file size is '${this.maxAllowedAssetSizeInBytes}'Bytes, but file has '${asset.size}' Bytes`,
    //                 asset.file_name
    //             );
    //             // remove binary data so that import proceeds & asset is created (so that it can be referenced by
    //             // content items )
    //             binaryDataToUpload = [];
    //             unsupportedBinaryFiles.push(binaryFile);
    //         }

    //         const uploadedBinaryFile = await this.client
    //             .uploadBinaryFile()
    //             .withData({
    //                 binaryData: binaryDataToUpload,
    //                 contentType: asset.type,
    //                 filename: asset.file_name
    //             })
    //             .toPromise()
    //             .then((m) => m)
    //             .catch((error) => this.handleImportError(error));

    //         if (!uploadedBinaryFile) {
    //             throw Error(`File not uploaded`);
    //         }

    //         // const assetData = this.getAddAssetModel(asset, uploadedBinaryFile.data.id, currentItems);

    //         // await this.client
    //         //     .addAsset()
    //         //     .withData((builder) => assetData)
    //         //     .toPromise()
    //         //     .then((response) => {
    //         //         importedItems.push({
    //         //             imported: response.data,
    //         //             csvModel: asset,
    //         //             importId: response.data.id,
    //         //             originalId: asset.id
    //         //         });
    //         //         this.processItem(response.data.fileName, 'asset', response.data);
    //         //     })
    //         //     .catch((error) => this.handleImportError(error));
    //     }

    //     return importedItems;
    // }

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

        // first process content items
        for (const importContentItem of importContentItems) {
            const preparedContentItem: ContentItemModels.ContentItem = await this.prepareContentItemForImportAsync(
                importContentItem,
                importedItems
            );
            preparedItems.push(preparedContentItem);

            // check if name should be updated, no other changes are supported
            if (this.shouldUpdateContentItem(importContentItem, preparedContentItem)) {
                const upsertedContentItem = (
                    await this.client
                        .upsertContentItem()
                        .byItemCodename(importContentItem.codename)
                        .withData({
                            name: importContentItem.name
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
                    return importContentItem.elements.map((m) => this.getElementContract(m, importedItems));
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
        }

        return {
            importedItems: preparedItems,
            importedLanguageVariants: upsertedLanguageVariants
        };
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

    // private async setWorkflowStepsOfLanguageVariantsAsync(
    //     languageVariants: LanguageVariantContracts.ILanguageVariantModelContract[],
    //     workflows: WorkflowContracts.IWorkflowContract[]
    // ): Promise<void> {
    //     if (!languageVariants.length) {
    //         return;
    //     }

    //     for (const languageVariant of languageVariants) {
    //         const itemCodename: string | undefined = languageVariant.item.codename;
    //         const languageCodename: string | undefined = languageVariant.language.codename;
    //         const workflowStepCodename: string | undefined = languageVariant.workflow_step.codename;

    //         if (!itemCodename) {
    //             throw Error(`Missing item codename for item '${languageVariant.item.id}'`);
    //         }
    //         if (!languageCodename) {
    //             throw Error(`Missing language codename for item '${itemCodename}'`);
    //         }

    //         if (!workflowStepCodename) {
    //             throw Error(`Missing workflow step codename for item '${itemCodename}'`);
    //         }

    //         const isPublished = this.isLanguageVariantPublished(languageVariant, workflows);
    //         const isArchived = this.isLanguageVariantArchived(languageVariant, workflows);

    //         if (isPublished) {
    //             await this.client
    //                 .publishLanguageVariant()
    //                 .byItemCodename(itemCodename)
    //                 .byLanguageCodename(languageCodename)
    //                 .withoutData()
    //                 .toPromise()
    //                 .then((response) => {
    //                     this.processItem(`${itemCodename} (${languageCodename})`, 'publish', response.data);
    //                 })
    //                 .catch((error) => this.handleImportError(error));
    //         } else if (isArchived) {
    //             const defaultWorkflow = this.getDefaultWorkflow(workflows);

    //             await this.client
    //                 .changeWorkflowOfLanguageVariant()
    //                 .byItemCodename(itemCodename)
    //                 .byLanguageCodename(languageCodename)
    //                 .withData({
    //                     step_identifier: {
    //                         codename: defaultWorkflow.archived_step.codename
    //                     },
    //                     workflow_identifier: {
    //                         codename: defaultWorkflow.codename
    //                     }
    //                 })
    //                 .toPromise()
    //                 .then((response) => {
    //                     this.processItem(`${itemCodename} (${languageCodename})`, 'archive', response.data);
    //                 })
    //                 .catch((error) => this.handleImportError(error));
    //         } else {
    //             const workflowData = this.getWorkflowAndStepOfLanguageVariant(languageVariant, workflows);

    //             if (!workflowData) {
    //                 throw Error(`Invalid workflow data for language variant '${itemCodename}'`);
    //             }

    //             await this.client
    //                 .changeWorkflowOfLanguageVariant()
    //                 .byItemCodename(itemCodename)
    //                 .byLanguageCodename(languageCodename)
    //                 .withData({
    //                     step_identifier: {
    //                         codename: workflowData.workflowStep.codename
    //                     },
    //                     workflow_identifier: {
    //                         codename: workflowData.workflow.codename
    //                     }
    //                 })
    //                 .toPromise()
    //                 .then((response) => {
    //                     this.processItem(
    //                         `${itemCodename} (${languageCodename}) - ${workflowData.workflow.name} -> ${workflowData.workflowStep.name}`,
    //                         'changeWorkflowStep',
    //                         response.data
    //                     );
    //                 })
    //                 .catch((error) => this.handleImportError(error));
    //         }
    //     }
    // }

    private async getWorkflowsAsync(): Promise<WorkflowModels.Workflow[]> {
        return (await this.client.listWorkflows().toPromise()).data;
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

    // private getAddAssetModel(
    //     assetContract: AssetContracts.IAssetModelContract,
    //     binaryFileId: string,
    //     currentItems: IImportItemResult[]
    // ): AssetModels.IAddAssetRequestData {
    //     const model: AssetModels.IAddAssetRequestData = {
    //         descriptions: assetContract.descriptions,
    //         file_reference: {
    //             id: binaryFileId,
    //             type: assetContract.file_reference.type
    //         },
    //         external_id: assetContract.external_id,
    //         folder: assetContract.folder,
    //         title: assetContract.title
    //     };

    //     // replace ids
    //     idTranslateHelper.replaceIdReferencesWithNewId(model, currentItems);

    //     return model;
    // }

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
        element: IImportContentItemElement,
        importItems: IImportItemResult[]
    ): ElementContracts.IContentItemElementContract {
        const importContract = translationHelper.transformToImportValue(
            element.value,
            element.codename,
            element.type,
            importItems
        );

        if (!importContract) {
            throw Error(`Missing import contract for element `);
        }

        return importContract;
    }

    private shouldUpdateContentItem(
        importContentItem: IImportContentItem,
        item: ContentItemModels.ContentItem
    ): boolean {
        return importContentItem.name !== item.name;
    }
}
