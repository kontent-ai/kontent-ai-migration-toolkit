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
    MigrationElementValue
} from '../core/index.js';
import { ElementContracts, ManagementClient } from '@kontent-ai/management-sdk';

export type ImportSourceType = 'zip' | 'file';

export interface ImportData {
    readonly items: MigrationItem[];
    readonly assets: MigrationAsset[];
}

export interface ImportContextConfig {
    readonly logger: Logger;
    readonly managementClient: ManagementClient;
    readonly externalIdGenerator: ExternalIdGenerator;
    readonly importData: ImportData;
}

export interface ImportAdapter {
    readonly name: string;
    readonly targetEnvironmentClient: ManagementClient;
    importAsync(data: ImportData): Promise<void>;
}

export type GetFlattenedElement = (contentTypeCodename: string, elementCodename: string) => FlattenedContentTypeElement;

export interface CategorizedImportData {
    readonly assets: MigrationAsset[];
    readonly componentItems: MigrationItem[];
    readonly contentItems: MigrationItem[];
}

export interface ImportContext {
    readonly categorizedImportData: CategorizedImportData;
    readonly referencedData: ReferencedDataInMigrationItems;
    readonly getItemStateInTargetEnvironment: (itemCodename: string) => ItemStateInTargetEnvironmentByCodename;
    readonly getLanguageVariantStateInTargetEnvironment: (
        itemCodename: string,
        languageCodename: string
    ) => LanguageVariantStateInTargetEnvironmentByCodename;
    readonly getAssetStateInTargetEnvironment: (assetCodename: string) => AssetStateInTargetEnvironmentByCodename;
    readonly getElement: GetFlattenedElement;
}

export type ImportTransformFunc = (data: {
    readonly value: MigrationElementValue;
    readonly elementCodename: string;
    readonly importContext: ImportContext;
    readonly migrationItems: MigrationItem[];
}) => Promise<ElementContracts.IContentItemElementContract> | ElementContracts.IContentItemElementContract;

export interface DefaultImportAdapterConfig {
    readonly logger: Logger;
    readonly environmentId: string;
    readonly apiKey: string;
    readonly skipFailedItems: boolean;
    readonly retryStrategy?: IRetryStrategyOptions;
    readonly externalIdGenerator?: ExternalIdGenerator;
    readonly baseUrl?: string;
}

export interface ImportAllResult {
    readonly metadata: {
        readonly timestamp: Date;
        readonly environmentId: string;
    };
}

export interface FlattenedFolder {
    readonly name: string;
    readonly id: string;
    readonly externalId?: string;
}
