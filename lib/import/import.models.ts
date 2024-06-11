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
    FlattenedContentTypeElement
} from '../core/index.js';
import { ElementContracts, ManagementClient } from '@kontent-ai/management-sdk';

export type ImportSourceType = 'zip' | 'file';

export interface ImportData {
    items: MigrationItem[];
    assets: MigrationAsset[];
}

export interface ImportAdapter {
    readonly name: string;
    readonly client: ManagementClient;
    importAsync(data: ImportData): Promise<void>;
}

export type GetFlattenedElement = (
    contentTypeCodename: string,
    elementCodename: string
) => FlattenedContentTypeElement;

export interface ImportContext {
    componentItems: MigrationItem[];
    contentItems: MigrationItem[];
    referencedData: ReferencedDataInMigrationItems;
    itemsInTargetEnvironment: ItemStateInTargetEnvironmentByCodename[];
    getItemStateInTargetEnvironment: (itemCodename: string) => ItemStateInTargetEnvironmentByCodename;
    getLanguageVariantStateInTargetEnvironment: (
        itemCodename: string,
        languageCodename: string
    ) => LanguageVariantStateInTargetEnvironmentByCodename;
    getAssetStateInTargetEnvironment: (assetCodename: string) => AssetStateInTargetEnvironmentByCodename;
    getElement: GetFlattenedElement;
}

export type ImportTransformFunc = (data: {
    value: string | string[] | undefined;
    elementCodename: string;
    importContext: ImportContext;
    sourceItems: MigrationItem[];
}) => Promise<ElementContracts.IContentItemElementContract>;

export interface DefaultImportAdapterConfig {
    logger: Logger;
    environmentId: string;
    apiKey: string;
    skipFailedItems: boolean;
    retryStrategy?: IRetryStrategyOptions;
    externalIdGenerator?: ExternalIdGenerator;
    baseUrl?: string;
    canImport?: {
        contentItem?: (item: MigrationItem) => boolean | Promise<boolean>;
        asset?: (item: MigrationAsset) => boolean | Promise<boolean>;
    };
}

export interface ImportAllResult {
    metadata: {
        timestamp: Date;
        environmentId: string;
    };
}

export interface FlattenedFolder {
    name: string;
    id: string;
    externalId?: string;
}
