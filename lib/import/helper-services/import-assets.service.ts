import { AssetModels, ManagementClient } from '@kontent-ai/management-sdk';
import { MigrationAsset, Logger, processInChunksAsync, runMapiRequestAsync } from '../../core/index.js';
import mime from 'mime';
import chalk from 'chalk';
import { ImportContext } from '../import.models.js';

export function getImportAssetsService(logger: Logger, managementClient: ManagementClient): ImportAssetsService {
    return new ImportAssetsService(logger, managementClient);
}

export class ImportAssetsService {
    private readonly importAssetsChunkSize: number = 1;

    constructor(private readonly logger: Logger, private readonly managementClient: ManagementClient) {}

    async importAssetsAsync(data: { assets: MigrationAsset[]; importContext: ImportContext }): Promise<void> {
        this.logger.log({
            type: 'info',
            message: `Categorizing '${chalk.yellow(data.assets.length.toString())}' assets`
        });
        const assetsToUpload = this.getAssetsToUpload({
            assets: data.assets,
            managementClient: this.managementClient,
            importContext: data.importContext
        });

        const skippedAssetsCount = data.assets.length - assetsToUpload.length;

        if (skippedAssetsCount) {
            this.logger.log({
                type: 'skip',
                message: `Skipping upload for '${chalk.yellow(
                    skippedAssetsCount.toString()
                )}' assets as they already exist`
            });
        }

        this.logger.log({
            type: 'upload',
            message: `Uploading '${chalk.yellow(assetsToUpload.length.toString())}' assets`
        });

        await processInChunksAsync<MigrationAsset, void>({
            logger: this.logger,
            chunkSize: this.importAssetsChunkSize,
            items: assetsToUpload,
            itemInfo: (input) => {
                return {
                    itemType: 'asset',
                    title: input.title
                };
            },
            processAsync: async (asset, logSpinner) => {
                const uploadedBinaryFile = await runMapiRequestAsync({
                    logger: this.logger,
                    func: async () =>
                        (
                            await this.managementClient
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
                    logger: this.logger,
                    func: async () =>
                        (
                            await this.managementClient
                                .addAsset()
                                .withData((builder) => {
                                    const data: AssetModels.IAddAssetRequestData = {
                                        file_reference: {
                                            id: uploadedBinaryFile.id,
                                            type: 'internal'
                                        },
                                        codename: asset.codename,
                                        title: asset.title,
                                        external_id: asset.externalId,
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
                                    return data;
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
    }

    private getAssetsToUpload(data: {
        assets: MigrationAsset[];
        managementClient: ManagementClient;
        importContext: ImportContext;
    }): MigrationAsset[] {
        return data.assets.filter((asset) => {
            return data.importContext.getAssetStateInTargetEnvironment(asset.codename).state === 'doesNotExists';
        });
    }
}
