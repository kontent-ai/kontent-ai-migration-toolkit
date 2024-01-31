import { AssetModels, ManagementClient } from '@kontent-ai/management-sdk';
import { IImportedData, is404Error, logItemAction, processInChunksAsync } from '../../core/index.js';
import { IParsedAsset } from '../import.models.js';
import mime from 'mime';

export class ImportAssetsHelper {
    private readonly importAssetsChunkSize: number = 5;

    async importAssetsAsync(data: {
        managementClient: ManagementClient;
        assets: IParsedAsset[];
        importedData: IImportedData;
    }): Promise<void> {
        await processInChunksAsync<IParsedAsset, void>({
            chunkSize: this.importAssetsChunkSize,
            items: data.assets,
            itemInfo: (input, output) => {
                return {
                    itemType: 'asset',
                    title: input.filename,
                    partA: input.extension
                };
            },
            processFunc: async (asset) => {
                // use asset id as external id
                const assetExternalId: string = asset.assetId;

                // check if asset with given external id already exists
                let existingAsset: AssetModels.Asset | undefined;

                try {
                    // when target project is the same as source project, the id of asset would be the same
                    // and such assets should not be imported again
                    existingAsset = await data.managementClient
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
                    existingAsset = await data.managementClient
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
                    // only import asset if it didn't exist
                    const uploadedBinaryFile = await data.managementClient
                        .uploadBinaryFile()
                        .withData({
                            binaryData: asset.binaryData,
                            contentType: mime.getType(asset.filename) ?? '',
                            filename: asset.filename
                        })
                        .toPromise();

                    logItemAction('upload', 'binaryFile', {
                        title: asset.filename
                    });

                    const createdAsset = await data.managementClient
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

                    data.importedData.assets.push({
                        imported: createdAsset,
                        original: asset
                    });

                    logItemAction('create', 'asset', {
                        title: asset.filename
                    });
                } else {
                    data.importedData.assets.push({
                        imported: existingAsset,
                        original: asset
                    });
                    logItemAction('skip', 'asset', {
                        title: asset.filename
                    });
                }
            }
        });
    }
}

export const importAssetsHelper = new ImportAssetsHelper();
