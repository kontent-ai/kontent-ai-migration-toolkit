import { IContentItem, IContentType, ElementType, Elements } from '@kontent-ai/delivery-sdk';
import { extractAssetIdFromUrl, getExtension, extractFilenameFromUrl } from '../../core/index.js';
import { IExportedAsset } from '../export.models.js';

export class ExportAssetsHelper {
    async extractAssetsAsync(items: IContentItem[], types: IContentType[]): Promise<IExportedAsset[]> {
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
                                    const asset: IExportedAsset = {
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
                            assets.push(
                                ...richTextElement.images.map((m) => {
                                    const asset: IExportedAsset = {
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

        const uniqueAssets = [...new Map(assets.map((item) => [item.url, item])).values()]; // filters unique values

        return uniqueAssets;
    }
}

export const exportAssetsHelper = new ExportAssetsHelper();
