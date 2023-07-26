import { IRetryStrategyOptions } from '@kontent-ai/core-sdk';

import { IPackageMetadata } from '../core';
import { IContentItem, IContentType, IDeliveryClient, ILanguage } from '@kontent-ai/delivery-sdk';

export interface IExportFilter {
    /**
     * Array of content type codenames to export. Defaults to all content types if none type is provided.
     */
    types?: string[];
}

export interface IExportConfig {
    environmentId: string;
    secureApiKey?: string;
    apiKey?: string;
    previewApiKey?: string;
    baseUrl?: string;
    exportTypes?: string[];
    exportAssets: boolean;
    retryStrategy?: IRetryStrategyOptions;
    fetchAssetDetails?: boolean;
    customItemsExport?: (client: IDeliveryClient) => Promise<IContentItem[]>
}

export interface IExportData {
    contentItems: IContentItem[];
    contentTypes: IContentType[];
    languages: ILanguage[];
    assets: IExportedAsset[];
}

export interface IExportAllResult {
    metadata: IPackageMetadata;
    data: IExportData;
}

export interface IExportedAsset {
    url: string;
    extension: string;
    assetId: string;
    filename: string;
}
