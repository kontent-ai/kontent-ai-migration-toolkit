import { AssetModels, ManagementClient } from '@kontent-ai/management-sdk';
import { IImportedData, is404Error, logAction } from '../../core';
import { IImportAsset } from '../import.models';

export class ImportAssetsHelper {
    async importAssetsAsync(
        managementClient: ManagementClient,
        assets: IImportAsset[],
        importedData: IImportedData
    ): Promise<void> {
        for (const asset of assets) {
            // use asset id as external id
            const assetExternalId: string = asset.assetId;

            // check if asset with given external id already exists
            let existingAsset: AssetModels.Asset | undefined;

            try {
                // when target project is the same as source project, the id of asset would be the same
                // and such asset should not be imported again
                existingAsset = await managementClient
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
                existingAsset = await managementClient
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
                const uploadedBinaryFile = await managementClient
                    .uploadBinaryFile()
                    .withData({
                        binaryData: asset.binaryData,
                        contentType: asset.mimeType ?? '',
                        filename: asset.filename
                    })
                    .toPromise();

                logAction('upload', 'binaryFile', {
                    title: asset.filename
                });

                const createdAsset = await managementClient
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

                logAction('create', 'asset', {
                    title: asset.filename
                });
            } else {
                importedData.assets.push({
                    imported: existingAsset,
                    original: asset
                });
                logAction('skipUpdate', 'asset', {
                    title: asset.filename
                });
            }
        }
    }
}

export const importAssetsHelper = new ImportAssetsHelper();
