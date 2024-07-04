import {
    MigrationItem,
    MigrationAsset,
    Logger,
    AssetStateInTargetEnvironmentByCodename,
    ItemStateInTargetEnvironmentByCodename,
    ReferencedDataInMigrationItems,
    LanguageVariantStateInTargetEnvironmentByCodename,
    ExternalIdGenerator,
    FlattenedContentTypeElement,
    MigrationElementValue,
    MigrationElementType,
    MigrationData,
    ManagementClientConfig,
    FlattenedContentType
} from '../core/index.js';
import {
    AssetModels,
    CollectionModels,
    ContentItemModels,
    ElementContracts,
    LanguageModels,
    LanguageVariantModels,
    ManagementClient,
    WorkflowModels
} from '@kontent-ai/management-sdk';

export interface ImportContextConfig {
    readonly logger: Logger;
    readonly managementClient: Readonly<ManagementClient>;
    readonly externalIdGenerator: ExternalIdGenerator;
    readonly migrationData: MigrationData;
}

export interface ImportContextEnvironmentData {
    readonly languages: readonly LanguageModels.LanguageModel[];
    readonly collections: readonly CollectionModels.Collection[];
    readonly workflows: readonly WorkflowModels.Workflow[];
    readonly types: readonly FlattenedContentType[];
}

export type GetFlattenedElementByCodenames = (
    contentTypeCodename: string,
    elementCodename: string,
    expectedElementType: MigrationElementType
) => FlattenedContentTypeElement;

export interface CategorizedImportData {
    readonly assets: readonly MigrationAsset[];
    readonly contentItems: readonly MigrationItem[];
}

export interface ImportContext {
    readonly categorizedImportData: CategorizedImportData;
    readonly referencedData: ReferencedDataInMigrationItems;
    readonly environmentData: ImportContextEnvironmentData;
    readonly getItemStateInTargetEnvironment: (itemCodename: string) => ItemStateInTargetEnvironmentByCodename;
    readonly getLanguageVariantStateInTargetEnvironment: (
        itemCodename: string,
        languageCodename: string
    ) => LanguageVariantStateInTargetEnvironmentByCodename;
    readonly getAssetStateInTargetEnvironment: (assetCodename: string) => AssetStateInTargetEnvironmentByCodename;
    readonly getElement: GetFlattenedElementByCodenames;
}

export type ImportTransformFunc = (data: {
    readonly value: MigrationElementValue;
    readonly elementCodename: string;
    readonly importContext: ImportContext;
    readonly migrationItems: readonly MigrationItem[];
}) => ElementContracts.IContentItemElementContract;

export interface ImportConfig extends ManagementClientConfig {
    readonly data: MigrationData;
    readonly externalIdGenerator?: ExternalIdGenerator;
    readonly logger?: Logger;
}

export interface ImportResult {
    readonly uploadedAssets: readonly AssetModels.Asset[];
    readonly editedAssets: readonly AssetModels.Asset[];
    readonly contentItems: readonly ContentItemModels.ContentItem[];
    readonly languageVariants: readonly LanguageVariantModels.ContentItemLanguageVariant[];
}
