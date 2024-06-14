import { AssetModels, ManagementClient } from '@kontent-ai/management-sdk';
import { MigrationAsset, Logger, processInChunksAsync, runMapiRequestAsync } from '../../core/index.js';
import mime from 'mime';
import chalk from 'chalk';
import { ImportContext } from '../import.models.js';

export function assetsImporter(data: {
    readonly logger: Logger;
    readonly client: ManagementClient;
    readonly importContext: ImportContext;
}) {
    const importAssetsChunkSize = 1;
    const getAssetsToUpload: () => MigrationAsset[] = () => {
        return data.importContext.assets.filter((asset) => {
            return data.importContext.getAssetStateInTargetEnvironment(asset.codename).state === 'doesNotExists';
        });
    };

    const importAsync = async () => {
        data.logger.log({
            type: 'info',
            message: `Categorizing '${chalk.yellow(data.importContext.assets.length.toString())}' assets`
        });

        const assetsToUpload = getAssetsToUpload();
        const skippedAssetsCount = data.importContext.assets.length - assetsToUpload.length;

        if (skippedAssetsCount) {
            data.logger.log({
                type: 'skip',
                message: `Skipping upload for '${chalk.yellow(
                    skippedAssetsCount.toString()
                )}' assets as they already exist`
            });
        }

        data.logger.log({
            type: 'upload',
            message: `Uploading '${chalk.yellow(assetsToUpload.length.toString())}' assets`
        });

        await processInChunksAsync<MigrationAsset, void>({
            logger: data.logger,
            chunkSize: importAssetsChunkSize,
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
                    func: async () =>
                        (
                            await data.client
                                .uploadBinaryFile()
                                .withData({
                                    binaryData: asset.binaryData,
                                    contentType: mime.getType(asset.filename) ?? '',
                                    filename: asset.filename
                                })
                                .toPromise()
                        ).data,
                    action: 'upload',
                    type: 'binaryFile',
                    logSpinner: logSpinner,
                    itemName: `${asset.title ?? asset.filename}`
                });

                await runMapiRequestAsync({
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
                                        collection: asset.collection
                                            ? {
                                                  reference: {
                                                      codename: asset.collection.codename
                                                  }
                                              }
                                            : undefined,
                                        descriptions: asset.descriptions
                                            ? asset.descriptions.map((m) => {
                                                  const assetDescription: AssetModels.IAssetFileDescription = {
                                                      description: m.description ?? '',
                                                      language: {
                                                          codename: m.language.codename
                                                      }
                                                  };

                                                  return assetDescription;
                                              })
                                            : []
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

    return {
        importAsync
    };
}
