import { AssetModels, ManagementClient } from '@kontent-ai/management-sdk';
import { IImportedData, IMigrationAsset, Log, is404Error, processInChunksAsync } from '../../core/index.js';
import mime from 'mime';
import colors from 'colors';

export function getImportAssetsHelper(log?: Log): ImportAssetsHelper {
    return new ImportAssetsHelper(log);
}

export class ImportAssetsHelper {
    private readonly importAssetsChunkSize: number = 1;
    private readonly fetchAssetsChunkSize: number = 1;

    constructor(private readonly log?: Log) {}

    async importAssetsAsync(data: {
        managementClient: ManagementClient;
        assets: IMigrationAsset[];
        importedData: IImportedData;
    }): Promise<void> {
        this.log?.console?.({
            type: 'info',
            message: `Categorizing '${colors.yellow(data.assets.length.toString())}' assets`
        });
        const filteredAssets = await this.getAssetsToUploadAsync({
            assets: data.assets,
            managementClient: data.managementClient
        });

        // add existing assets to imported data
        data.importedData.assets.push(...filteredAssets.existingAssets);

        if (filteredAssets.existingAssets.length) {
            this.log?.console?.({
                type: 'skip',
                message: `Skipping upload for '${colors.yellow(
                    filteredAssets.existingAssets.length.toString()
                )}' assets as they already exist`
            });
        }

        this.log?.console?.({
            type: 'upload',
            message: `Uploading '${colors.yellow(filteredAssets.assetsToUpload.length.toString())}' assets`
        });

        await processInChunksAsync<IMigrationAsset, void>({
            log: this.log,
            type: 'asset',
            chunkSize: this.importAssetsChunkSize,
            items: filteredAssets.assetsToUpload,
            itemInfo: (input) => {
                return {
                    itemType: 'asset',
                    title: input.filename
                };
            },
            processFunc: async (asset) => {
                // only import asset if it didn't exist
                this.log?.spinner?.text?.({
                    type: 'upload',
                    message: asset.filename
                });

                const uploadedBinaryFile = await data.managementClient
                    .uploadBinaryFile()
                    .withData({
                        binaryData: asset.binaryData,
                        contentType: mime.getType(asset.filename) ?? '',
                        filename: asset.filename
                    })
                    .toPromise();

                this.log?.spinner?.text?.({
                    type: 'create',
                    message: asset.filename
                });

                const createdAsset = await data.managementClient
                    .addAsset()
                    .withData((builder) => {
                        return {
                            file_reference: {
                                id: uploadedBinaryFile.data.id,
                                type: 'internal'
                            },
                            codename: asset.codename,
                            title: asset.title,
                            external_id: asset.assetId
                        };
                    })
                    .toPromise()
                    .then((m) => m.data);

                data.importedData.assets.push({
                    imported: createdAsset,
                    original: asset
                });
            }
        });
    }

    private async getAssetsToUploadAsync(data: {
        assets: IMigrationAsset[];
        managementClient: ManagementClient;
    }): Promise<{
        assetsToUpload: IMigrationAsset[];
        existingAssets: {
            original: IMigrationAsset;
            imported: AssetModels.Asset;
        }[];
    }> {
        const assetsToUpload: IMigrationAsset[] = [];
        const existingAssets: {
            original: IMigrationAsset;
            imported: AssetModels.Asset;
        }[] = [];

        await processInChunksAsync<IMigrationAsset, void>({
            log: this.log,
            type: 'asset',
            chunkSize: this.fetchAssetsChunkSize,
            items: data.assets,
            itemInfo: (input) => {
                return {
                    itemType: 'asset',
                    title: input.filename
                };
            },
            processFunc: async (asset) => {
                // check if asset with given external id already exists
                let existingAsset: AssetModels.Asset | undefined;

                if (asset.assetId) {
                    try {
                        // when target project is the same as source project, the id of asset would be the same
                        // and such assets should not be imported again
                        existingAsset = await data.managementClient
                            .viewAsset()
                            .byAssetId(asset.assetId)
                            .toPromise()
                            .then((m) => m.data);
                    } catch (error) {
                        if (!is404Error(error)) {
                            throw error;
                        }
                    }
                }

                if (asset.assetExternalId) {
                    try {
                        // check if asset with given external id was already created
                        existingAsset = await data.managementClient
                            .viewAsset()
                            .byAssetExternalId(asset.assetExternalId)
                            .toPromise()
                            .then((m) => m.data);
                    } catch (error) {
                        if (!is404Error(error)) {
                            throw error;
                        }
                    }
                }

                if (!existingAsset) {
                    // only import asset if it didn't exist
                    assetsToUpload.push(asset);
                } else {
                    existingAssets.push({
                        imported: existingAsset,
                        original: asset
                    });
                }
            }
        });

        return {
            assetsToUpload: assetsToUpload,
            existingAssets: existingAssets
        };
    }
}
