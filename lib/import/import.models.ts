import {
    AssetFolderModels,
    AssetModels,
    CollectionModels,
    ContentItemModels,
    ElementContracts,
    LanguageModels,
    LanguageVariantModels,
    ManagementClient,
    WorkflowModels
} from '@kontent-ai/management-sdk';
import {
    AssetStateInTargetEnvironmentByCodename,
    ExternalIdGenerator,
    FlattenedContentType,
    FlattenedContentTypeElement,
    ItemProcessingResult,
    ItemStateInTargetEnvironmentByCodename,
    LanguageVariantStateInTargetEnvironmentByCodename,
    Logger,
    ManagementClientConfig,
    MigrationAsset,
    MigrationData,
    MigrationElementTransformData,
    MigrationElementType,
    MigrationItem,
    ReferencedDataInMigrationItems
} from '../core/index.js';

export interface ImportContextConfig {
    readonly logger: Logger;
    readonly managementClient: Readonly<ManagementClient>;
    readonly externalIdGenerator: ExternalIdGenerator;
    readonly migrationData: MigrationData;
}

export interface ImportContextEnvironmentData {
    readonly languages: readonly Readonly<LanguageModels.LanguageModel>[];
    readonly assetFolders: readonly Readonly<AssetFolderModels.AssetFolder>[];
    readonly collections: readonly Readonly<CollectionModels.Collection>[];
    readonly workflows: readonly Readonly<WorkflowModels.Workflow>[];
    readonly types: readonly Readonly<FlattenedContentType>[];
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
    readonly elementData: MigrationElementTransformData;
    readonly elementCodename: string;
    readonly importContext: ImportContext;
    readonly migrationItems: readonly MigrationItem[];
}) => ElementContracts.IContentItemElementContract;

export interface ImportConfig extends ManagementClientConfig {
    readonly data: MigrationData;
    readonly externalIdGenerator?: ExternalIdGenerator;
    readonly logger?: Logger;
}

export interface AssetToEdit {
    migrationAsset: MigrationAsset;
    targetAsset: Readonly<AssetModels.Asset>;
    replaceBinaryFile: boolean;
}

export type ImportedItem = ItemProcessingResult<MigrationItem, Readonly<ContentItemModels.ContentItem>>;
export type ImportedLanguageVariant = ItemProcessingResult<
    MigrationItem,
    readonly Readonly<LanguageVariantModels.ContentItemLanguageVariant>[]
>;
export type EditedAsset = ItemProcessingResult<AssetToEdit, Readonly<AssetModels.Asset>>;
export type ImportedAsset = ItemProcessingResult<MigrationAsset, Readonly<AssetModels.Asset>>;

export interface ImportResult {
    readonly uploadedAssets: readonly ImportedAsset[];
    readonly editedAssets: readonly EditedAsset[];
    readonly contentItems: readonly ImportedItem[];
    readonly languageVariants: readonly ImportedLanguageVariant[];
}
