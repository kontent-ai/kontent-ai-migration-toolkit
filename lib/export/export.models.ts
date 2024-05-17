import colors from 'colors';
import { IRetryStrategyOptions } from '@kontent-ai/core-sdk';

import {
    IMigrationItem,
    IMigrationAsset,
    Log,
    IFlattenedContentType,
    IAssetStateInSourceEnvironmentById,
    IFlattenedContentTypeElement,
    IItemStateInSourceEnvironmentById,
    IReferencedDataInLanguageVariants
} from '../core/index.js';
import {
    LanguageVariantModels,
    ContentItemModels,
    WorkflowModels,
    CollectionModels,
    LanguageModels,
    SharedModels,
    TaxonomyModels
} from '@kontent-ai/management-sdk';

export interface IExportContextEnvironmentData {
    languages: LanguageModels.LanguageModel[];
    contentTypes: IFlattenedContentType[];
    collections: CollectionModels.Collection[];
    workflows: WorkflowModels.Workflow[];
    taxonomies: TaxonomyModels.Taxonomy[];
}

export type ExportTransformFunc = (data: {
    exportItem: IKontentAiPreparedExportItem;
    typeElement: IFlattenedContentTypeElement;
    value: string | number | SharedModels.ReferenceObject[] | undefined;
    context: IExportContext;
}) => string | string[] | undefined;

export interface IExportContext {
    environmentData: IExportContextEnvironmentData;
    referencedData: IReferencedDataInLanguageVariants;
    getItemStateInSourceEnvironment: (id: string) => IItemStateInSourceEnvironmentById;
    getAssetStateInSourceEnvironment: (id: string) => IAssetStateInSourceEnvironmentById;
    preparedExportItems: IKontentAiPreparedExportItem[];
}

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
