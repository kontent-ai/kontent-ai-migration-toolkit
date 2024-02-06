import { IContentItem, IContentType, ElementType, Elements } from '@kontent-ai/delivery-sdk';
import { HttpService } from '@kontent-ai/core-sdk';
import {
    extractAssetIdFromUrl,
    getExtension,
    extractFilenameFromUrl,
    defaultRetryStrategy,
    logDebug,
    processInChunksAsync,
    IMigrationAsset
} from '../../../../core/index.js';
import colors from 'colors';

type ExportAssetWithoutBinaryData = Omit<IMigrationAsset, 'binaryData'>;

export class ExportAssetsHelper {
    private readonly downloadAssetBinaryDataChunkSize: number = 10;
    private readonly httpService: HttpService = new HttpService();

    async extractAssetsAsync(items: IContentItem[], types: IContentType[]): Promise<IMigrationAsset[]> {
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
                                        url: m.url,
                                        assetId: extractAssetIdFromUrl(m.url),
                                        filename: extractFilenameFromUrl(m.url),
                                        extension: getExtension(m.url) ?? ''
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
                                        url: m.url,
                                        assetId: extractAssetIdFromUrl(m.url),
                                        filename: extractFilenameFromUrl(m.url),
                                        extension: getExtension(m.url) ?? ''
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

        logDebug({
            type: 'info',
            message: `Preparing to download '${colors.yellow(uniqueAssets.length.toString())}' assets`
        });

        const exportedAssets: IMigrationAsset[] = await processInChunksAsync<
            ExportAssetWithoutBinaryData,
            IMigrationAsset
        >({
            chunkSize: this.downloadAssetBinaryDataChunkSize,
            itemInfo: (input) => {
                return {
                    title: input.url,
                    itemType: 'asset'
                };
            },
            items: uniqueAssets,
            processFunc: async (item) => {
                const exportAsset: IMigrationAsset = {
                    ...item,
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

export const exportAssetsHelper = new ExportAssetsHelper();
