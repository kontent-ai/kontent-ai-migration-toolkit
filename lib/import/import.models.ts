import { IRetryStrategyOptions } from '@kontent-ai/core-sdk';

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
    MigrationData
} from '../core/index.js';
import {
    CollectionModels,
    ContentItemModels,
    ElementContracts,
    LanguageModels,
    LanguageVariantModels,
    ManagementClient
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
}

export type GetFlattenedElementByCodenames = (
    contentTypeCodename: string,
    elementCodename: string,
    expectedElementType: MigrationElementType
) => FlattenedContentTypeElement;

export interface CategorizedImportData {
    readonly assets: readonly MigrationAsset[];
    readonly componentItems: readonly MigrationItem[];
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

export interface ImportConfig {
    readonly data: MigrationData;
    readonly environmentId: string;
    readonly apiKey: string;
    readonly skipFailedItems?: boolean;
    readonly retryStrategy?: Readonly<IRetryStrategyOptions>;
    readonly externalIdGenerator?: ExternalIdGenerator;
    readonly baseUrl?: string;
    readonly logger?: Logger;
}

export interface ImportResult {
    readonly contentItems: readonly ContentItemModels.ContentItem[];
    readonly languageVariants: readonly LanguageVariantModels.ContentItemLanguageVariant[];
}
