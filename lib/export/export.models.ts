import { IRetryStrategyOptions } from '@kontent-ai/core-sdk';

import {
    Logger,
    FlattenedContentType,
    AssetStateInSourceEnvironmentById,
    FlattenedContentTypeElement,
    ItemStateInSourceEnvironmentById,
    ReferencedDataInLanguageVariants,
    MigrationElementValue,
    MigrationComponent,
    MigrationUrlSlugMode
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

export interface ExportElement {
    readonly value: ExportElementValue;
    readonly components: MigrationComponent[];
    readonly urlSlugMode: MigrationUrlSlugMode | undefined;
}

export type ExportTransformFunc = (data: {
    readonly typeElement: FlattenedContentTypeElement;
    readonly exportElement: ExportElement;
    readonly context: ExportContext;
}) => MigrationElementValue;

export interface ExportContext {
    readonly environmentData: ExportContextEnvironmentData;
    readonly referencedData: ReferencedDataInLanguageVariants;
    readonly getItemStateInSourceEnvironment: (id: string) => ItemStateInSourceEnvironmentById;
    readonly getAssetStateInSourceEnvironment: (id: string) => AssetStateInSourceEnvironmentById;
    readonly exportItems: ExportItem[];
    readonly getElement: GetFlattenedElementByIds;
}

export interface SourceExportItem {
    readonly itemCodename: string;
    readonly languageCodename: string;
}

export interface ExportConfig {
    readonly environmentId: string;
    readonly apiKey: string;
    readonly exportItems: SourceExportItem[];

    readonly logger?: Logger;
    readonly baseUrl?: string;
    readonly retryStrategy?: IRetryStrategyOptions;
}

export interface DefaultExportContextConfig {
    readonly logger: Logger;
    readonly exportItems: SourceExportItem[];
    readonly managementClient: ManagementClient;
}

export type GetFlattenedElementByIds = (contentTypeId: string, elementId: string) => FlattenedContentTypeElement;

export interface ExportItem {
    readonly languageVariant: LanguageVariantModels.ContentItemLanguageVariant;
    readonly contentItem: ContentItemModels.ContentItem;
    readonly collection: CollectionModels.Collection;
    readonly language: LanguageModels.LanguageModel;
    readonly workflow: WorkflowModels.Workflow;
    readonly workflowStepCodename: string;
    readonly requestItem: SourceExportItem;
    readonly contentType: FlattenedContentType;
}
