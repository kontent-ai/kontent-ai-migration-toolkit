import { AssetModels, ManagementClient } from '@kontent-ai/management-sdk';
import { IImportedData, is404Error, logAction, logProcessingDebug } from '../../core/index.js';
import { IImportAsset } from '../import.models.js';

export class ImportAssetsHelper {
    async importAssetsAsync(data: {
        managementClient: ManagementClient;
        assets: IImportAsset[];
        importedData: IImportedData;
    }): Promise<void> {
        let assetIndex: number = 1;
        for (const asset of data.assets) {
            logProcessingDebug({
                index: assetIndex,
                totalCount: data.assets.length,
                itemType: 'asset',
                title: `${asset.filename}`
            });

            // use asset id as external id
            const assetExternalId: string = asset.assetId;

            // check if asset with given external id already exists
            let existingAsset: AssetModels.Asset | undefined;

            try {
                // when target project is the same as source project, the id of asset would be the same
                // and such asset should not be imported again
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
                // only import asset if it wasn't already there
                const uploadedBinaryFile = await data.managementClient
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

                logAction('create', 'asset', {
                    title: asset.filename
                });
            } else {
                data.importedData.assets.push({
                    imported: existingAsset,
                    original: asset
                });
                logAction('skip', 'asset', {
                    title: asset.filename
                });
            }

            assetIndex++;
        }
    }
}

export const importAssetsHelper = new ImportAssetsHelper();
