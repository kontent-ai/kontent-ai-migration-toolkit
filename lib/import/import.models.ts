import { IRetryStrategyOptions } from '@kontent-ai/core-sdk';

import { ContentElementType, IPackageMetadata } from '../core';

export interface IImportConfig {
    managementApiKey: string;
    skipFailedItems: boolean;
    retryStrategy?: IRetryStrategyOptions;
    baseUrl?: string;
    environmentId: string;
    canImport?: {
        contentItem?: (item: IParsedContentItem) => boolean | Promise<boolean>;
        asset?: (item: IImportAsset) => boolean | Promise<boolean>;
    };
}

export interface IImportAllResult {
    metadata: {
        timestamp: Date;
        environmentId: string;
    };
}

export interface IImportAsset {
    binaryData: Buffer | Blob;
    assetId: string;
    filename: string;
    mimeType: string | undefined;
    extension: string | undefined;
}

export interface IParsedAsset {
    assetId: string;
    filename: string;
    extension: string;
    url: string;
}

export interface IImportSource {
    importData: {
        items: IParsedContentItem[];
        assets: IImportAsset[];
    };
    metadata?: IPackageMetadata;
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
