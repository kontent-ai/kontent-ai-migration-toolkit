import {
    AssetContracts,
    AssetFolderContracts,
    AssetFolderModels,
    AssetModels,
    ContentItemContracts,
    ContentItemModels,
    LanguageVariantContracts,
    LanguageVariantModels,
    ManagementClient,
    SharedModels} from '@kontent-ai/management-sdk';
import { version, name } from '../../package.json';

import {
    idTranslateHelper,
    IImportItemResult,
    ActionType,
    translationHelper,
    ValidImportContract,
    ValidImportModel,
    handleError,
    defaultRetryStrategy,
    printProjectInfoToConsoleAsync
} from '../core';
import { IBinaryFile, IImportConfig, IImportSource } from './import.models';
import { HttpService } from '@kontent-ai/core-sdk';

export class ImportService {
    private readonly client: ManagementClient;

    /**
     * Maximum allowed size of asset in Bytes.
     * Currently 1e8 = 100 MB
     */
    private readonly maxAllowedAssetSizeInBytes: number = 1e8;

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

    public async importFromSourceAsync(
        sourceData: IImportSource
    ): Promise<IImportItemResult<ValidImportContract, ValidImportModel>[]> {
        return await this.importAsync(sourceData);
    }

    public async importAsync(
        sourceData: IImportSource
    ): Promise<IImportItemResult<ValidImportContract, ValidImportModel>[]> {
        const importedItems: IImportItemResult<ValidImportContract, ValidImportModel>[] = [];
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

        if (this.config.enableLog) {
            console.log(`Translating object ids to codenames`);
        }

        // this is an optional step where users can exclude certain objects from being
        // imported via import configuration.
        // this has to be done before translating ids
        this.removeSkippedItemsFromImport(sourceData);

        // translate ids to codenames for certain objects types
        this.translateIds(sourceData);

        if (this.config.enableLog) {
            console.log(`Removing skipped items`);
        }

        if (this.config.enableLog) {
            console.log(`Importing data`);
        }

        // import order matters

        // ### Assets
        if (sourceData.importData.assets.length) {
            const importedAssets = await this.importAssetsAsync(
                sourceData.importData.assets,
                sourceData.binaryFiles,
                importedItems
            );
            importedItems.push(...importedAssets);
        } else {
            if (this.config.enableLog) {
                console.log(`Skipping assets`);
            }
        }

        // ### Content items
        if (sourceData.importData.contentItems.length) {
            const importedContentItems = await this.importContentItemAsync(sourceData.importData.contentItems);
            importedItems.push(...importedContentItems);
        } else {
            if (this.config.enableLog) {
                console.log(`Skipping content items`);
            }
        }

        // ### Language variants
        if (sourceData.importData.languageVariants) {
            const importedLanguageVariants = await this.importLanguageVariantsAsync(
                sourceData.importData.languageVariants,
                importedItems
            );
            importedItems.push(...importedLanguageVariants);

            // if (this.config.preserveWorkflow) {
            //     await this.setWorkflowStepsOfLanguageVariantsAsync(
            //         sourceData.importData.languageVariants,
            //         sourceData.importData.workflows
            //     );
            // }

            // if (this.config.workflowIdForImportedItems) {
            //     await this.moveLanguageVariantsToCustomWorkflowStepAsync(
            //         this.config.workflowIdForImportedItems,
            //         sourceData.importData.languageVariants
            //     );
            // }
        } else {
            if (this.config.enableLog) {
                console.log(`Skipping language variants`);
            }
        }

        if (this.config.enableLog) {
            console.log(`Finished importing data`);
        }

        return importedItems;
    }

    private translateIds(source: IImportSource): void {
        const defaultLanguageCodename = 'todo';

        // in following objects replace id references with codename
        translationHelper.replaceIdReferencesWithCodenames(
            source.importData.assets,
            source.importData,
            {},
            defaultLanguageCodename
        );
        translationHelper.replaceIdReferencesWithCodenames(source.importData.contentItems, source.importData, {});
        translationHelper.replaceIdReferencesWithCodenames(
            source.importData.languageVariants,
            source.importData,
            {},
            defaultLanguageCodename
        );
       
    }

    private removeSkippedItemsFromImport(source: IImportSource): void {
        if (this.config.canImport && this.config.canImport.asset) {
            for (const item of source.importData.assets) {
                const shouldImport = this.config.canImport.asset(item);
                if (!shouldImport) {
                    source.importData.assets = source.importData.assets.filter((m) => m.id !== item.id);
                }
            }
        }

        if (this.config.canImport && this.config.canImport.contentItem) {
            for (const item of source.importData.contentItems) {
                const shouldImport = this.config.canImport.contentItem(item);
                if (!shouldImport) {
                    source.importData.contentItems = source.importData.contentItems.filter((m) => m.id !== item.id);
                }
            }
        }

        if (this.config.canImport && this.config.canImport.languageVariant) {
            for (const item of source.importData.languageVariants) {
                const shouldImport = this.config.canImport.languageVariant(item);
                if (!shouldImport) {
                    source.importData.languageVariants = source.importData.languageVariants.filter(
                        (m) => m.item.id !== item.item.id && m.language.id !== item.language.id
                    );
                }
            }
        }
    }

    private async importAssetsAsync(
        assets: AssetContracts.IAssetModelContract[],
        binaryFiles: IBinaryFile[],
        currentItems: IImportItemResult<ValidImportContract, ValidImportModel>[]
    ): Promise<IImportItemResult<AssetContracts.IAssetModelContract, AssetModels.Asset>[]> {
        const importedItems: IImportItemResult<AssetContracts.IAssetModelContract, AssetModels.Asset>[] = [];
        const unsupportedBinaryFiles: IBinaryFile[] = [];

        for (const asset of assets) {
            const binaryFile = binaryFiles.find((m) => m.asset.id === asset.id);

            if (!binaryFile) {
                throw Error(`Could not find binary file for asset with id '${asset.id}'`);
            }

            let binaryDataToUpload: any = binaryFile.binaryData;
            if (binaryFile.asset.size >= this.maxAllowedAssetSizeInBytes) {
                if (this.config.onUnsupportedBinaryFile) {
                    this.config.onUnsupportedBinaryFile(binaryFile);
                }
                console.log(
                    `Removing binary data from file due to size. Max. file size is '${this.maxAllowedAssetSizeInBytes}'Bytes, but file has '${asset.size}' Bytes`,
                    asset.file_name
                );
                // remove binary data so that import proceeds & asset is created (so that it can be referenced by
                // content items )
                binaryDataToUpload = [];
                unsupportedBinaryFiles.push(binaryFile);
            }

            const uploadedBinaryFile = await this.client
                .uploadBinaryFile()
                .withData({
                    binaryData: binaryDataToUpload,
                    contentType: asset.type,
                    filename: asset.file_name
                })
                .toPromise()
                .then((m) => m)
                .catch((error) => this.handleImportError(error));

            if (!uploadedBinaryFile) {
                throw Error(`File not uploaded`);
            }

            const assetData = this.getAddAssetModel(asset, uploadedBinaryFile.data.id, currentItems);

            await this.client
                .addAsset()
                .withData((builder) => assetData)
                .toPromise()
                .then((response) => {
                    importedItems.push({
                        imported: response.data,
                        original: asset,
                        importId: response.data.id,
                        originalId: asset.id
                    });
                    this.processItem(response.data.fileName, 'asset', response.data);
                })
                .catch((error) => this.handleImportError(error));
        }

        return importedItems;
    }

    private async importContentItemAsync(
        contentItems: ContentItemContracts.IContentItemModelContract[]
    ): Promise<IImportItemResult<ContentItemContracts.IContentItemModelContract, ContentItemModels.ContentItem>[]> {
        const importedItems: IImportItemResult<
            ContentItemContracts.IContentItemModelContract,
            ContentItemModels.ContentItem
        >[] = [];

        for (const contentItem of contentItems) {
            const typeCodename = (contentItem.type as any).codename;

            if (!typeCodename) {
                throw Error(`Content item '${contentItem.codename}' has unset type codename`);
            }

            await this.client
                .addContentItem()
                .withData({
                    name: contentItem.name,
                    type: {
                        codename: typeCodename
                    },
                    codename: contentItem.codename,
                    external_id: contentItem.external_id
                })
                .toPromise()
                .then((response) => {
                    importedItems.push({
                        imported: response.data,
                        original: contentItem,
                        importId: response.data.id,
                        originalId: contentItem.id
                    });
                    this.processItem(response.data.name, 'contentItem', response.data);
                })
                .catch((error) => this.handleImportError(error));
        }

        return importedItems;
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

    private async importLanguageVariantsAsync(
        languageVariants: LanguageVariantContracts.ILanguageVariantModelContract[],
        currentItems: IImportItemResult<ValidImportContract, ValidImportModel>[]
    ): Promise<
        IImportItemResult<
            LanguageVariantContracts.ILanguageVariantModelContract,
            LanguageVariantModels.ContentItemLanguageVariant
        >[]
    > {
        const importedItems: IImportItemResult<
            LanguageVariantContracts.ILanguageVariantModelContract,
            LanguageVariantModels.ContentItemLanguageVariant
        >[] = [];

        for (const languageVariant of languageVariants) {
            const itemCodename: string | undefined = languageVariant.item.codename;
            const languageCodename: string | undefined = languageVariant.language.codename;

            if (!itemCodename) {
                throw Error(`Missing item codename for item '${languageVariant.item.id}'`);
            }
            if (!languageCodename) {
                throw Error(`Missing language codename for item '${itemCodename}'`);
            }

            // replace ids in assets with new ones
            idTranslateHelper.replaceIdReferencesWithNewId(languageVariant, currentItems);

            await this.client
                .upsertLanguageVariant()
                .byItemCodename(itemCodename)
                .byLanguageCodename(languageCodename)
                .withData((builder) => languageVariant.elements)
                .toPromise()
                .then((response) => {
                    importedItems.push({
                        imported: response.data,
                        original: languageVariant,
                        importId: response.data.item.id,
                        originalId: languageVariant.item.id
                    });
                    this.processItem(`${itemCodename} (${languageCodename})`, 'contentItem', response.data);
                })
                .catch((error) => this.handleImportError(error));
        }

        return importedItems;
    }

    private handleImportError(error: any | SharedModels.ContentManagementBaseKontentError): void {
        console.log(error);
        handleError(error);
    }

    private processItem(title: string, type: ActionType, data: any): void {
        if (!this.config.onImport) {
            return;
        }

        this.config.onImport({
            data,
            title,
            type
        });
    }

    private getAddAssetModel(
        assetContract: AssetContracts.IAssetModelContract,
        binaryFileId: string,
        currentItems: IImportItemResult<ValidImportContract, ValidImportModel>[]
    ): AssetModels.IAddAssetRequestData {
        const model: AssetModels.IAddAssetRequestData = {
            descriptions: assetContract.descriptions,
            file_reference: {
                id: binaryFileId,
                type: assetContract.file_reference.type
            },
            external_id: assetContract.external_id,
            folder: assetContract.folder,
            title: assetContract.title
        };

        // replace ids
        idTranslateHelper.replaceIdReferencesWithNewId(model, currentItems);

        return model;
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
}
