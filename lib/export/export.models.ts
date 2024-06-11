import { IRetryStrategyOptions } from '@kontent-ai/core-sdk';

import {
    MigrationItem,
    MigrationAsset,
    Logger,
    FlattenedContentType,
    AssetStateInSourceEnvironmentById,
    FlattenedContentTypeElement,
    ItemStateInSourceEnvironmentById,
    ReferencedDataInLanguageVariants
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

export interface ExportContextEnvironmentData {
    languages: LanguageModels.LanguageModel[];
    contentTypes: FlattenedContentType[];
    collections: CollectionModels.Collection[];
    workflows: WorkflowModels.Workflow[];
    taxonomies: TaxonomyModels.Taxonomy[];
}

export type ExportTransformFunc = (data: {
    exportItem: KontentAiPreparedExportItem;
    typeElement: FlattenedContentTypeElement;
    value: string | number | SharedModels.ReferenceObject[] | undefined;
    context: ExportContext;
}) => string | string[] | undefined;

export interface ExportContext {
    environmentData: ExportContextEnvironmentData;
    referencedData: ReferencedDataInLanguageVariants;
    getItemStateInSourceEnvironment: (id: string) => ItemStateInSourceEnvironmentById;
    getAssetStateInSourceEnvironment: (id: string) => AssetStateInSourceEnvironmentById;
    preparedExportItems: KontentAiPreparedExportItem[];
}

export interface ExportAdapter {
    readonly name: string;
    exportAsync(): Promise<ExportAdapterResult>;
}

export interface ExportAdapterResult {
    items: MigrationItem[];
    assets: MigrationAsset[];
}

export interface KontentAiExportRequestItem {
    itemCodename: string;
    languageCodename: string;
}

export interface DefaultExportAdapterConfig {
    environmentId: string;
    apiKey: string;
    exportItems: KontentAiExportRequestItem[];
    logger: Logger;

    baseUrl?: string;
    skipFailedItems?: boolean;
    retryStrategy?: IRetryStrategyOptions;
}

export interface KontentAiPreparedExportItem {
    languageVariant: LanguageVariantModels.ContentItemLanguageVariant;
    contentItem: ContentItemModels.ContentItem;
    collection: CollectionModels.Collection;
    language: LanguageModels.LanguageModel;
    workflow: WorkflowModels.Workflow;
    workflowStepCodename: string;
    requestItem: KontentAiExportRequestItem;
    contentType: FlattenedContentType;
}
