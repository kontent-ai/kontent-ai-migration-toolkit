import colors from 'colors';
import { IRetryStrategyOptions } from '@kontent-ai/core-sdk';

import { IMigrationItem, IMigrationAsset, Log, IFlattenedContentType } from '../core/index.js';
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

export interface IKontentAiExportRequestItem {
    itemCodename: string;
    languageCodename: string;
}

export interface IKontentAiExportAdapterConfig {
    log: Log;
    environmentId: string;
    managementApiKey: string;
    baseUrl?: string;
    exportItems: IKontentAiExportRequestItem[];
    retryStrategy?: IRetryStrategyOptions;
}

export interface IKontentAiPreparedExportItem {
    languageVariant: LanguageVariantModels.ContentItemLanguageVariant;
    contentItem: ContentItemModels.ContentItem;
    collection: CollectionModels.Collection;
    language: LanguageModels.LanguageModel;
    workflow: WorkflowModels.Workflow;
    workflowStepCodename: string;
    requestItem: IKontentAiExportRequestItem;
    contentType: IFlattenedContentType;
}

export function throwErrorForItemRequest(itemRequest: IKontentAiExportRequestItem, message: string): never {
    throw Error(
        `Export failed for item '${colors.yellow(itemRequest.itemCodename)}' in language '${colors.cyan(
            itemRequest.languageCodename
        )}'. Reason: ${message}`
    );
}
