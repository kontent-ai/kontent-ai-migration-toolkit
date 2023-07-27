import { IContentItem, IContentType, ElementType, Elements } from '@kontent-ai/delivery-sdk';
import { createManagementClient } from '@kontent-ai/management-sdk';
import { extractAssetIdFromUrl, getExtension, defaultRetryStrategy } from '../../core';
import { logDebug } from '../../core/log-helper';
import { IExportConfig, IExportedAsset } from '../export.models';

export class ExportAssetsHelper {
    async extractAssetsAsync(config: IExportConfig,items: IContentItem[], types: IContentType[]): Promise<IExportedAsset[]> {
        const assets: IExportedAsset[] = [];

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
                            assets.push(
                                ...assetElement.value.map((m) => {
                                    const assetId = extractAssetIdFromUrl(m.url);
                                    const extension = getExtension(m.url) ?? '';
                                    const asset: IExportedAsset = {
                                        url: m.url,
                                        assetId: assetId,
                                        filename: `${assetId}.${extension}`,
                                        extension: extension
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
                            assets.push(
                                ...richTextElement.images.map((m) => {
                                    const assetId = extractAssetIdFromUrl(m.url);
                                    const extension = getExtension(m.url) ?? '';
                                    const asset: IExportedAsset = {
                                        url: m.url,
                                        assetId: assetId,
                                        filename: `${assetId}.${extension}`,
                                        extension: extension
                                    };

                                    return asset;
                                })
                            );
                        }
                    }
                }
            }
        }

        const uniqueAssets = [...new Map(assets.map((item) => [item.url, item])).values()]; // filters unique values

        if (config.fetchAssetDetails === true) {
            if (!config.apiKey) {
                throw Error(`Management API key is required to fetch asset details`);
            }

            const managementClient = createManagementClient({
                apiKey: config.apiKey,
                environmentId: config.environmentId,
                retryStrategy: config.retryStrategy ?? defaultRetryStrategy
            });

            for (const asset of uniqueAssets) {
                const assetResponse = await managementClient.viewAsset().byAssetId(asset.assetId).toPromise();

                logDebug('info', 'Fetched asset details', asset.assetId, assetResponse.data.fileName);

                asset.filename = assetResponse.data.fileName;
            }
        }

        return uniqueAssets;
    }
}

export const exportAssetsHelper = new ExportAssetsHelper();
