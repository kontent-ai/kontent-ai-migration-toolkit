import { IRetryStrategyOptions } from '@kontent-ai/core-sdk';

import {
    IMigrationItem,
    IMigrationAsset,
    ILogger,
    IAssetStateInTargetEnvironmentByCodename,
    IItemStateInTargetEnvironmentByCodename,
    IReferencedDataInMigrationItems,
    ILanguageVariantStateInTargetEnvironmentByCodename,
    IExternalIdGenerator,
    IFlattenedContentTypeElement
} from '../core/index.js';
import { ElementContracts, ManagementClient } from '@kontent-ai/management-sdk';

export type ImportSourceType = 'zip' | 'file';

export interface IImportData {
    items: IMigrationItem[];
    assets: IMigrationAsset[];
}

export interface IImportAdapter {
    readonly name: string;
    readonly client: ManagementClient;
    importAsync(data: IImportData): Promise<void>;
}

export type GetFlattenedElement = (
    contentTypeCodename: string,
    elementCodename: string
) => IFlattenedContentTypeElement;

export interface IImportContext {
    componentItems: IMigrationItem[];
    contentItems: IMigrationItem[];
    referencedData: IReferencedDataInMigrationItems;
    itemsInTargetEnvironment: IItemStateInTargetEnvironmentByCodename[];
    getItemStateInTargetEnvironment: (itemCodename: string) => IItemStateInTargetEnvironmentByCodename;
    getLanguageVariantStateInTargetEnvironment: (
        itemCodename: string,
        languageCodename: string
    ) => ILanguageVariantStateInTargetEnvironmentByCodename;
    getAssetStateInTargetEnvironment: (assetCodename: string) => IAssetStateInTargetEnvironmentByCodename;
    getElement: GetFlattenedElement;
}

export type ImportTransformFunc = (data: {
    value: string | string[] | undefined;
    elementCodename: string;
    importContext: IImportContext;
    sourceItems: IMigrationItem[];
}) => Promise<ElementContracts.IContentItemElementContract>;

export interface IDefaultImportAdapterConfig {
    logger: ILogger;
    environmentId: string;
    apiKey: string;
    skipFailedItems: boolean;
    retryStrategy?: IRetryStrategyOptions;
    externalIdGenerator?: IExternalIdGenerator;
    baseUrl?: string;
    canImport?: {
        contentItem?: (item: IMigrationItem) => boolean | Promise<boolean>;
        asset?: (item: IMigrationAsset) => boolean | Promise<boolean>;
    };
}

export interface IImportAllResult {
    metadata: {
        timestamp: Date;
        environmentId: string;
    };
}

export interface IFlattenedFolder {
    name: string;
    id: string;
    externalId?: string;
}
