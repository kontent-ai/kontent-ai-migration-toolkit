import { AssetModels, ManagementClient } from '@kontent-ai/management-sdk';
import {
    MigrationAsset,
    Logger,
    processItemsAsync,
    runMapiRequestAsync,
    MigrationAssetDescription,
    MigrationReference
} from '../../core/index.js';
import mime from 'mime';
import chalk from 'chalk';
import { ImportContext, ImportResult } from '../import.models.js';
import { shouldUpdateAsset } from '../comparers/asset-comparer.js';

export function assetsImporter(data: {
    readonly logger: Logger;
    readonly client: Readonly<ManagementClient>;
    readonly importContext: ImportContext;
}) {
    const getAssetsToUpload = (): readonly MigrationAsset[] => {
        return data.importContext.categorizedImportData.assets.filter((asset) => {
            return data.importContext.getAssetStateInTargetEnvironment(asset.codename).state === 'doesNotExists';
        });
    };

    const getAssetsToEdit = (): readonly MigrationAsset[] => {
        return data.importContext.categorizedImportData.assets.filter((migrationAsset) => {
            const assetState = data.importContext.getAssetStateInTargetEnvironment(migrationAsset.codename);

            if (!assetState.asset || assetState.state === 'doesNotExists') {
                return false;
            }

            return shouldUpdateAsset({
                collections: data.importContext.environmentData.collections,
                languages: data.importContext.environmentData.languages,
                migrationAsset: migrationAsset,
                targetAsset: assetState.asset
            });
        });
    };

    const editAssets = async (assetsToEdit: readonly MigrationAsset[]): Promise<readonly AssetModels.Asset[]> => {
        data.logger.log({
            type: 'upsert',
            message: `Upserting '${chalk.yellow(assetsToEdit.length.toString())}' assets`
        });

        return await processItemsAsync<MigrationAsset, Readonly<AssetModels.Asset>>({
            action: 'Upserting assets',
            logger: data.logger,
            parallelLimit: 1,
            items: assetsToEdit,
            itemInfo: (input) => {
                return {
                    itemType: 'asset',
                    title: input.title
                };
            },
            processAsync: async (asset, logSpinner) => {
                return await runMapiRequestAsync({
                    logger: data.logger,
                    func: async () => {
                        return (
                            await data.client
                                .upsertAsset()
                                .byAssetCodename(asset.codename)
                                .withData(() => {
                                    return {
                                        title: asset.title,
                                        descriptions: mapAssetDescriptions(asset.descriptions),
                                        collection: mapAssetCollection(asset.collection)
                                    };
                                })
                                .toPromise()
                        ).data;
                    },
                    action: 'upload',
                    type: 'binaryFile',
                    logSpinner: logSpinner,
                    itemName: `${asset.title ?? asset.filename}`
                });
            }
        });
    };

    const mapAssetCollection = (
        migrationCollection: MigrationReference | undefined
    ): AssetModels.IAssetCollectionReferenceObject | undefined => {
        return migrationCollection
            ? {
                  reference: {
                      codename: migrationCollection.codename
                  }
              }
            : undefined;
    };

    const mapAssetDescriptions = (
        migrationDescription: readonly MigrationAssetDescription[] | undefined
    ): AssetModels.IAssetFileDescription[] => {
        return (migrationDescription ?? []).map((m) => {
            const assetDescription: AssetModels.IAssetFileDescription = {
                description: m.description ?? '',
                language: {
                    codename: m.language.codename
                }
            };

            return assetDescription;
        });
    };

    const uploadAssets = async (assetsToUpload: readonly MigrationAsset[]): Promise<readonly AssetModels.Asset[]> => {
        data.logger.log({
            type: 'upload',
            message: `Uploading '${chalk.yellow(assetsToUpload.length.toString())}' assets`
        });

        return await processItemsAsync<MigrationAsset, Readonly<AssetModels.Asset>>({
            action: 'Uploading assets',
            logger: data.logger,
            parallelLimit: 3,
            items: assetsToUpload,
            itemInfo: (input) => {
                return {
                    itemType: 'asset',
                    title: input.title
                };
            },
            processAsync: async (asset, logSpinner) => {
                const uploadedBinaryFile = await runMapiRequestAsync({
                    logger: data.logger,
                    func: async () => {
                        return (
                            await data.client
                                .uploadBinaryFile()
                                .withData({
                                    binaryData: asset.binaryData,
                                    contentType: mime.getType(asset.filename) ?? '',
                                    filename: asset.filename
                                })
                                .toPromise()
                        ).data;
                    },
                    action: 'upload',
                    type: 'binaryFile',
                    logSpinner: logSpinner,
                    itemName: `${asset.title ?? asset.filename}`
                });

                return await runMapiRequestAsync({
                    logger: data.logger,
                    func: async () =>
                        (
                            await data.client
                                .addAsset()
                                .withData(() => {
                                    const assetStateInTargetEnv = data.importContext.getAssetStateInTargetEnvironment(
                                        asset.codename
                                    );

                                    const assetRequestData: AssetModels.IAddAssetRequestData = {
                                        file_reference: {
                                            id: uploadedBinaryFile.id,
                                            type: 'internal'
                                        },
                                        codename: asset.codename,
                                        title: asset.title,
                                        external_id: assetStateInTargetEnv.externalIdToUse,
                                        collection: mapAssetCollection(asset.collection),
                                        descriptions: mapAssetDescriptions(asset.descriptions)
                                    };
                                    return assetRequestData;
                                })
                                .toPromise()
                        ).data,
                    action: 'create',
                    type: 'asset',
                    logSpinner: logSpinner,
                    itemName: `${asset.title ?? asset.filename}`
                });
            }
        });
    };

    const importAsync = async (): Promise<Pick<ImportResult, 'editedAssets' | 'uploadedAssets'>> => {
        return {
            editedAssets: await editAssets(getAssetsToEdit()),
            uploadedAssets: await uploadAssets(getAssetsToUpload())
        };
    };

    return {
        importAsync
    };
}
