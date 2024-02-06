import { IRetryStrategyOptions } from '@kontent-ai/core-sdk';

import { MigrationElementType, ContentItemsFetchMode, IMigrationItem, LogLevel, IMigrationAsset } from '../core/index.js';

export interface IImportConfig {
    logLevel?: LogLevel;
    managementApiKey: string;
    skipFailedItems: boolean;
    retryStrategy?: IRetryStrategyOptions;
    baseUrl?: string;
    environmentId: string;
    contentItemsFetchMode?: ContentItemsFetchMode;
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

export interface IImportContentTypeElement {
    codename: string;
    type: MigrationElementType;
}

export interface IImportContentType {
    contentTypeCodename: string;
    elements: IImportContentTypeElement[];
}
