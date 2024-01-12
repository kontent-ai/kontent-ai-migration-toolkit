import { IContentItem, IContentType, ElementType, Elements } from '@kontent-ai/delivery-sdk';
import { HttpService } from '@kontent-ai/core-sdk';
import {
    extractAssetIdFromUrl,
    getExtension,
    extractFilenameFromUrl,
    defaultRetryStrategy,
    formatBytes,
    logDebug,
    logProcessingDebug
} from '../../../../core/index.js';
import { IExportAsset } from '../../../export.models.js';

type ExportAssetWithoutBinaryData = Omit<IExportAsset, 'binaryData'>;

export class ExportAssetsHelper {
    private readonly httpService: HttpService = new HttpService();

    async extractAssetsAsync(items: IContentItem[], types: IContentType[]): Promise<IExportAsset[]> {
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

        const exportedAssets: IExportAsset[] = [];

        logDebug({
            type: 'info',
            message: `Preparing to download '${uniqueAssets.length.toString()}' assets`
        });

        let assetIndex: number = 0;
        for (const uniqueAsset of uniqueAssets) {
            assetIndex++;

            const binaryDataResponse = await this.getBinaryDataFromUrlAsync(uniqueAsset.url);

            logProcessingDebug({
                index: assetIndex,
                totalCount: uniqueAssets.length,
                itemType: 'binaryFile',
                title: uniqueAsset.url,
                partA: formatBytes(binaryDataResponse.contentLength)
            });

            exportedAssets.push({
                ...uniqueAsset,
                binaryData: (await this.getBinaryDataFromUrlAsync(uniqueAsset.url)).data
            });
        }

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
