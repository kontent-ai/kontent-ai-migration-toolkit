import { IRetryStrategyOptions } from '@kontent-ai/core-sdk';

import {
    MigrationItem,
    MigrationAsset,
    Logger,
    FlattenedContentType,
    AssetStateInSourceEnvironmentById,
    FlattenedContentTypeElement,
    ItemStateInSourceEnvironmentById,
    ReferencedDataInLanguageVariants,
    MigrationElementValue
} from '../core/index.js';
import {
    LanguageVariantModels,
    ContentItemModels,
    WorkflowModels,
    CollectionModels,
    LanguageModels,
    TaxonomyModels,
    ManagementClient,
    SharedModels
} from '@kontent-ai/management-sdk';

export interface ExportContextEnvironmentData {
    readonly languages: LanguageModels.LanguageModel[];
    readonly contentTypes: FlattenedContentType[];
    readonly collections: CollectionModels.Collection[];
    readonly workflows: WorkflowModels.Workflow[];
    readonly taxonomies: TaxonomyModels.Taxonomy[];
}

export type ExportElementValue = string | number | SharedModels.ReferenceObject[] | undefined;

export type ExportTransformFunc = (data: {
    readonly exportItem: KontentAiPreparedExportItem;
    readonly typeElement: FlattenedContentTypeElement;
    readonly value: ExportElementValue;
    readonly context: ExportContext;
}) => MigrationElementValue;

export interface ExportContext {
    readonly environmentData: ExportContextEnvironmentData;
    readonly referencedData: ReferencedDataInLanguageVariants;
    readonly getItemStateInSourceEnvironment: (id: string) => ItemStateInSourceEnvironmentById;
    readonly getAssetStateInSourceEnvironment: (id: string) => AssetStateInSourceEnvironmentById;
    readonly preparedExportItems: KontentAiPreparedExportItem[];
}

export interface ExportAdapter {
    readonly name: string;
    exportAsync(): Promise<ExportAdapterResult>;
}

export interface ExportAdapterResult {
    readonly items: MigrationItem[];
    readonly assets: MigrationAsset[];
}

export interface KontentAiExportRequestItem {
    readonly itemCodename: string;
    readonly languageCodename: string;
}

export interface DefaultExportAdapterConfig {
    readonly environmentId: string;
    readonly apiKey: string;
    readonly exportItems: KontentAiExportRequestItem[];
    readonly logger: Logger;

    readonly baseUrl?: string;
    readonly skipFailedItems?: boolean;
    readonly retryStrategy?: IRetryStrategyOptions;
}

export interface DefaultExportContextConfig {
    readonly logger: Logger;
    readonly exportItems: KontentAiExportRequestItem[];
    readonly managementClient: ManagementClient;
}

export interface KontentAiPreparedExportItem {
    readonly languageVariant: LanguageVariantModels.ContentItemLanguageVariant;
    readonly contentItem: ContentItemModels.ContentItem;
    readonly collection: CollectionModels.Collection;
    readonly language: LanguageModels.LanguageModel;
    readonly workflow: WorkflowModels.Workflow;
    readonly workflowStepCodename: string;
    readonly requestItem: KontentAiExportRequestItem;
    readonly contentType: FlattenedContentType;
}
