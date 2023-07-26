import { IRetryStrategyOptions } from '@kontent-ai/core-sdk';

import { ItemType, IPackageMetadata } from '../core';
import { ElementType } from '@kontent-ai/delivery-sdk';

export interface IImportConfig {
    apiKey: string;
    skipFailedItems: boolean;

    retryStrategy?: IRetryStrategyOptions;
    baseUrl?: string;
    environmentId: string;
    secureApiKey?: string;
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

export interface IPreparedImportItem<TItem> {
    type: ItemType;
    codename: string;
    item: TItem;
    deps: string[];
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

export interface IImportData {
    orderedImportItems: IPreparedImportItem<any>[];
}

export interface IFlattenedFolder {
    name: string;
    externalId?: string;
    id: string;
}

export interface IParsedElement {
    value: string;
    type: ElementType;
    codename: string;
}

export interface IParsedContentItem {
    codename: string;
    name: string;
    language: string;
    type: string;
    collection: string;
    last_modified: string;
    workflow_step?: string;

    [prop: string]: any;

    elements: IParsedElement[];
}

export interface IImportContentTypeElement {
    codename: string;
    type: ElementType;
}

export interface IImportContentType {
    contentTypeCodename: string;
    elements: IImportContentTypeElement[];
}
