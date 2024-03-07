import { IContentItem, IContentType, ElementType, Elements } from '@kontent-ai/delivery-sdk';
import { HttpService } from '@kontent-ai/core-sdk';
import {
    defaultRetryStrategy,
    processInChunksAsync,
    IMigrationAsset,
    Log,
    getAssetUrlPath,
    getAssetZipFilename
} from '../../../../core/index.js';
import colors from 'colors';
import { AssetModels, ManagementClient } from '@kontent-ai/management-sdk';

type ExportAssetWithoutBinaryData = {
    url: string;
};

type ExportAssetWithBinaryData = {
    binaryData: Buffer | Blob | undefined;
    url: string;
};

interface IExtractAssetsResult {
    migrationAssets: IMigrationAsset[];
    allAssets: AssetModels.Asset[];
}

export function getExportAssetsHelper(managementClient: ManagementClient, log: Log): ExportAssetsHelper {
    return new ExportAssetsHelper(managementClient, log);
}

export class ExportAssetsHelper {
    private readonly downloadAssetBinaryDataChunkSize: number = 10;
    private readonly httpService: HttpService = new HttpService();

    constructor(private readonly managementClient: ManagementClient, private readonly log: Log) {}

    async extractAssetsAsync(items: IContentItem[], types: IContentType[]): Promise<IExtractAssetsResult> {
        const assetsWithBinaryData = await this.getAssetsWithBinaryDataAsync(items, types);
        return await this.getMigrationAssetsAsync(assetsWithBinaryData);
    }

    private async getMigrationAssetsAsync(
        assetsWithBinaryData: ExportAssetWithBinaryData[]
    ): Promise<IExtractAssetsResult> {
        this.log.console?.({
            type: 'info',
            message: `Preparing to list all assets records for id translation (Asset url -> Asset id)`
        });

        this.log.spinner?.start();
        const managementAssets = (
            await this.managementClient
                .listAssets()
                .withListQueryConfig({
                    responseFetched: (response, token) => {
                        this?.log.spinner?.text?.({
                            type: 'fetch',
                            message: `Fetched '${colors.yellow(response.data.items.length.toString())}' asset records`
                        });
                    }
                })
                .toAllPromise()
        ).data;
        this.log.spinner?.stop();

        this.log.console?.({
            type: 'info',
            message: `Fetched '${colors.yellow(
                managementAssets.items.length.toString()
            )}' asset records. Starting id transform.`
        });

        const migrationAssets: IMigrationAsset[] = [];

        for (const assetWithBinaryData of assetsWithBinaryData) {
            const assetUrlPath = getAssetUrlPath(assetWithBinaryData.url).toLowerCase();

            const managementAsset = managementAssets.items.find(
                (m) => getAssetUrlPath(m.url).toLowerCase() === assetUrlPath
            );

            if (!managementAsset) {
                throw Error(`Could not find asset for url '${colors.red(assetWithBinaryData.url)}'`);
            }

            migrationAssets.push({
                binaryData: assetWithBinaryData.binaryData,
                title: managementAsset.title ?? managementAsset.fileName,
                codename: managementAsset.codename,
                filename: managementAsset.fileName,
                _zipFilename: getAssetZipFilename(managementAsset),
                assetId: managementAsset.id,
                assetExternalId: managementAsset.id // use external id to prevent same asset from being uploaded multiple times
            });
        }

        return {
            migrationAssets: migrationAssets,
            allAssets: managementAssets.items
        };
    }

    private async getAssetsWithBinaryDataAsync(
        items: IContentItem[],
        types: IContentType[]
    ): Promise<ExportAssetWithBinaryData[]> {
        const extractedAssets: ExportAssetWithoutBinaryData[] = [];

        for (const type of types) {
            const itemsOfType: IContentItem[] = items.filter((m) => m.system.type === type.system.codename);

            for (const element of type.elements) {
                if (!element.codename) {
                    continue;
                }
                if (element.type === ElementType.Asset) {
                    for (const item of itemsOfType) {
                        const assetElement = item.elements[element.codename] as Elements.AssetsElement;

                        if (assetElement.value.length) {
                            extractedAssets.push(
                                ...assetElement.value.map((m) => {
                                    const asset: ExportAssetWithoutBinaryData = {
                                        url: m.url
                                    };

                                    return asset;
                                })
                            );
                        }
                    }
                } else if (element.type === ElementType.RichText) {
                    for (const item of itemsOfType) {
                        const richTextElement = item.elements[element.codename] as Elements.RichTextElement;

                        if (richTextElement.images.length) {
                            extractedAssets.push(
                                ...richTextElement.images.map((m) => {
                                    const asset: ExportAssetWithoutBinaryData = {
                                        url: m.url
                                    };

                                    return asset;
                                })
                            );
                        }
                    }
                }
            }
        }

        // filters unique values
        const uniqueAssets: ExportAssetWithoutBinaryData[] = [
            ...new Map(extractedAssets.map((item) => [item.url, item])).values()
        ];

        this.log.console?.({
            type: 'info',
            message: `Preparing to download '${colors.yellow(uniqueAssets.length.toString())}' assets`
        });

        const exportedAssets: ExportAssetWithBinaryData[] = await processInChunksAsync<
            ExportAssetWithoutBinaryData,
            ExportAssetWithBinaryData
        >({
            log: this.log,
            type: 'asset',
            chunkSize: this.downloadAssetBinaryDataChunkSize,
            itemInfo: (input) => {
                return {
                    title: input.url,
                    itemType: 'asset'
                };
            },
            items: uniqueAssets,
            processFunc: async (item) => {
                const exportAsset: ExportAssetWithBinaryData = {
                    url: item.url,
                    binaryData: (await this.getBinaryDataFromUrlAsync(item.url)).data
                };

                return exportAsset;
            }
        });

        return exportedAssets;
    }

    private async getBinaryDataFromUrlAsync(url: string): Promise<{ data: any; contentLength: number }> {
        // temp fix for Kontent.ai Repository not validating url
        url = url.replace('#', '%23');

        const response = await this.httpService.getAsync(
            {
                url
            },
            {
                responseType: 'arraybuffer',
                retryStrategy: defaultRetryStrategy
            }
        );

        const contentLengthHeader = response.headers.find((m) => m.header.toLowerCase() === 'content-length');
        const contentLength = contentLengthHeader ? +contentLengthHeader.value : 0;

        return { data: response.data, contentLength: contentLength };
    }
}
