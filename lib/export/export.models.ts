import { IRetryStrategyOptions } from '@kontent-ai/core-sdk';

import { ContentElementType, IExportTransformConfig } from '../core/index.js';
import { IContentItem, IDeliveryClient } from '@kontent-ai/delivery-sdk';

export interface IExportAdapter {
    exportAsync(): Promise<IExportAdapterResult>;
}

export interface IExportAdapterResult {
    items: IExportContentItem[];
    assets: IExportAsset[];
}

export interface IExportFilter {
    /**
     * Array of content type codenames to export. Defaults to all content types if none type is provided.
     */
    types?: string[];
}

export interface IKontentAiExportAdapterConfig {
    environmentId: string;
    managementApiKey?: string;
    secureApiKey?: string;
    previewApiKey?: string;
    isPreview: boolean;
    isSecure: boolean;
    baseUrl?: string;
    exportTypes?: string[];
    exportLanguages?: string[];
    exportAssets: boolean;
    retryStrategy?: IRetryStrategyOptions;
    customItemsExport?: (client: IDeliveryClient) => Promise<IContentItem[]>;
    transformConfig?: IExportTransformConfig;
}

export interface IExportAsset {
    url: string;
    extension: string;
    assetId: string;
    filename: string;
    binaryData: Buffer | Blob;
}

export interface IExportElement {
    value: string | undefined | string[];
    type: ContentElementType;
    codename: string;
}

export interface IExportContentItem {
    system: {
        codename: string;
        id: string;
        name: string;
        language: string;
        type: string;
        collection: string;
        last_modified?: string;
        workflow_step?: string;
    };
    elements: IExportElement[];
}
