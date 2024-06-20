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
import { ElementContracts, ManagementClient } from '@kontent-ai/management-sdk';

export interface ImportContextConfig {
    readonly logger: Logger;
    readonly managementClient: ManagementClient;
    readonly externalIdGenerator: ExternalIdGenerator;
    readonly migrationData: MigrationData;
}

export type GetFlattenedElementByCodenames = (
    contentTypeCodename: string,
    elementCodename: string,
    expectedElementType: MigrationElementType
) => FlattenedContentTypeElement;

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
    readonly getElement: GetFlattenedElementByCodenames;
}

export type ImportTransformFunc = (data: {
    readonly value: MigrationElementValue;
    readonly elementCodename: string;
    readonly importContext: ImportContext;
    readonly migrationItems: MigrationItem[];
}) => ElementContracts.IContentItemElementContract;

export interface ImportConfig {
    readonly data: MigrationData;
    readonly environmentId: string;
    readonly apiKey: string;
    readonly skipFailedItems: boolean;
    readonly retryStrategy?: IRetryStrategyOptions;
    readonly externalIdGenerator?: ExternalIdGenerator;
    readonly baseUrl?: string;
    readonly logger?: Logger;
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
