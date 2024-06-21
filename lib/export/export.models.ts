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
    readonly languages: readonly LanguageModels.LanguageModel[];
    readonly contentTypes: readonly FlattenedContentType[];
    readonly collections: readonly CollectionModels.Collection[];
    readonly workflows: readonly WorkflowModels.Workflow[];
    readonly taxonomies: readonly TaxonomyModels.Taxonomy[];
}

export type ExportElementValue = string | number | SharedModels.ReferenceObject[] | undefined;

export interface ExportElement {
    readonly value: ExportElementValue;
    readonly components: readonly MigrationComponent[];
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
    readonly exportItems: readonly ExportItem[];
    readonly getElement: GetFlattenedElementByIds;
}

export interface SourceExportItem {
    readonly itemCodename: string;
    readonly languageCodename: string;
}

export interface ExportConfig {
    readonly environmentId: string;
    readonly apiKey: string;
    readonly exportItems: readonly SourceExportItem[];

    readonly logger?: Logger;
    readonly baseUrl?: string;
    readonly retryStrategy?: Readonly<IRetryStrategyOptions>;
}

export interface DefaultExportContextConfig {
    readonly logger: Logger;
    readonly exportItems: readonly SourceExportItem[];
    readonly managementClient: Readonly<ManagementClient>;
}

export type GetFlattenedElementByIds = (contentTypeId: string, elementId: string) => FlattenedContentTypeElement;

export interface ExportItem {
    readonly languageVariant: Readonly<LanguageVariantModels.ContentItemLanguageVariant>;
    readonly contentItem: Readonly<ContentItemModels.ContentItem>;
    readonly collection: Readonly<CollectionModels.Collection>;
    readonly language: Readonly<LanguageModels.LanguageModel>;
    readonly workflow: Readonly<WorkflowModels.Workflow>;
    readonly workflowStepCodename: string;
    readonly requestItem: SourceExportItem;
    readonly contentType: Readonly<FlattenedContentType>;
}
