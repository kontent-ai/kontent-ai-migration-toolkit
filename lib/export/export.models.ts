import { IRetryStrategyOptions } from '@kontent-ai/core-sdk';

import { IExportTransformConfig, IMigrationItem, IMigrationAsset, Log } from '../core/index.js';
import { IContentItem, IDeliveryClient } from '@kontent-ai/delivery-sdk';

export interface IExportAdapter {
    readonly name: string;
    exportAsync(): Promise<IExportAdapterResult>;
}

export interface IExportAdapterResult {
    items: IMigrationItem[];
    assets: IMigrationAsset[];
}

export interface IExportFilter {
    /**
     * Array of content type codenames to export. Defaults to all content types if none type is provided.
     */
    types?: string[];
}

export interface IKontentAiExportAdapterConfig {
    log: Log;
    environmentId: string;
    managementApiKey: string;
    secureApiKey?: string;
    previewApiKey?: string;
    isPreview: boolean;
    isSecure: boolean;
    baseUrl?: string;
    exportTypes?: string[];
    exportLanguages?: string[];
    retryStrategy?: IRetryStrategyOptions;
    customItemsExport?: (client: IDeliveryClient) => Promise<IContentItem[]>;
    transformConfig?: IExportTransformConfig;
}
