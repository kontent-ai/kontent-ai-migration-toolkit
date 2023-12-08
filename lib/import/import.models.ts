import { IRetryStrategyOptions } from '@kontent-ai/core-sdk';

import { ContentElementType } from '../core/index.js';

export interface IImportConfig {
    managementApiKey: string;
    skipFailedItems: boolean;
    retryStrategy?: IRetryStrategyOptions;
    baseUrl?: string;
    environmentId: string;
    canImport?: {
        contentItem?: (item: IParsedContentItem) => boolean | Promise<boolean>;
        asset?: (item: IParsedAsset) => boolean | Promise<boolean>;
    };
}

export interface IImportAllResult {
    metadata: {
        timestamp: Date;
        environmentId: string;
    };
}

export interface IParsedAssetRecord {
    assetId: string;
    filename: string;
    extension: string;
    url: string;
}

export interface IParsedAsset extends IParsedAssetRecord {
    binaryData: Buffer | Blob | undefined;
}

export interface IImportSource {
    importData: {
        items: IParsedContentItem[];
        assets: IParsedAsset[];
    };
}

export interface IFlattenedFolder {
    name: string;
    externalId?: string;
    id: string;
}

export interface IParsedElement {
    value: string | undefined | string[];
    type: ContentElementType;
    codename: string;
}

export interface IParsedContentItem {
    system: {
        codename: string;
        name: string;
        language: string;
        type: string;
        collection: string;
        last_modified?: string;
        workflow_step?: string;
    };
    elements: IParsedElement[];
}

export interface IImportContentTypeElement {
    codename: string;
    type: ContentElementType;
}

export interface IImportContentType {
    contentTypeCodename: string;
    elements: IImportContentTypeElement[];
}
