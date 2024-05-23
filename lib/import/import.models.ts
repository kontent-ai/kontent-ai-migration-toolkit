import { IRetryStrategyOptions } from '@kontent-ai/core-sdk';

import {
    IMigrationItem,
    IMigrationAsset,
    Log,
    IAssetStateInTargetEnvironmentByCodename,
    IItemStateInTargetEnvironmentByCodename,
    IReferencedDataInMigrationItems
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

export interface IImportContext {
    componentItems: IMigrationItem[];
    contentItems: IMigrationItem[];
    referencedData: IReferencedDataInMigrationItems;
    itemsInTargetEnvironment: IItemStateInTargetEnvironmentByCodename[];
    getItemStateInTargetEnvironment: (codename: string) => IItemStateInTargetEnvironmentByCodename;
    getAssetStateInTargetEnvironment: (codename: string) => IAssetStateInTargetEnvironmentByCodename;
}

export type ImportTransformFunc = (data: {
    value: string | string[] | undefined;
    elementCodename: string;
    importContext: IImportContext;
    sourceItems: IMigrationItem[];
}) => Promise<ElementContracts.IContentItemElementContract>;

export interface IKontentAiImportConfig {
    log: Log;
    apiKey: string;
    skipFailedItems: boolean;
    retryStrategy?: IRetryStrategyOptions;
    baseUrl?: string;
    environmentId: string;
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
    externalId?: string;
    id: string;
}
