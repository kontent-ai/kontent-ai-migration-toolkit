import colors from 'colors';
import { IRetryStrategyOptions } from '@kontent-ai/core-sdk';

import { IExportTransformConfig, IMigrationItem, IMigrationAsset, Log, IFlattenedContentType } from '../core/index.js';
import { IContentItem, IDeliveryClient } from '@kontent-ai/delivery-sdk';
import {
    LanguageVariantModels,
    ContentItemModels,
    WorkflowModels,
    CollectionModels,
    LanguageModels
} from '@kontent-ai/management-sdk';

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

export interface IKontentAiDeliveryExportAdapterConfig {
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

export interface IKontentAiManagementExportRequestItem {
    itemCodename: string;
    languageCodename: string;
}

export interface IKontentAiManagementExportAdapterConfig {
    log: Log;
    environmentId: string;
    managementApiKey: string;
    baseUrl?: string;
    exportItems: IKontentAiManagementExportRequestItem[];
    retryStrategy?: IRetryStrategyOptions;
}

export interface IKontentAiPreparedExportItem {
    languageVariant: LanguageVariantModels.ContentItemLanguageVariant;
    contentItem: ContentItemModels.ContentItem;
    collection: CollectionModels.Collection;
    language: LanguageModels.LanguageModel;
    workflow: WorkflowModels.Workflow;
    workflowStepCodename: string;
    requestItem: IKontentAiManagementExportRequestItem;
    contentType: IFlattenedContentType;
}

export function throwErrorForItemRequest(itemRequest: IKontentAiManagementExportRequestItem, message: string): never {
    throw Error(
        `Export failed for item '${colors.yellow(itemRequest.itemCodename)}' in language '${colors.cyan(
            itemRequest.languageCodename
        )}'. Reason: ${message}`
    );
}
