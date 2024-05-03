import { IRetryStrategyOptions } from '@kontent-ai/core-sdk';

import { IMigrationItem, IMigrationAsset, Log } from '../core/index.js';

export type ImportSourceType = 'zip' | 'file';

export interface IImportConfig {
    log: Log;
    sourceType: ImportSourceType;
    managementApiKey: string;
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

export interface IImportSource {
    importData: {
        items: IMigrationItem[];
        assets: IMigrationAsset[];
    };
}

export interface IFlattenedFolder {
    name: string;
    externalId?: string;
    id: string;
}
