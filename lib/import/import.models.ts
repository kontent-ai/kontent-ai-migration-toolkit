import { IRetryStrategyOptions } from '@kontent-ai/core-sdk';

import { IProcessedItem, ItemType, IPackageMetadata } from '../core';
import { ElementType } from '@kontent-ai/delivery-sdk';
import { IExportedAsset } from '../export';

export interface IImportConfig {
    retryStrategy?: IRetryStrategyOptions;
    workflowIdForImportedItems?: string;
    baseUrl?: string;
    projectId: string;
    apiKey: string;
    preserveWorkflow: boolean;
    onImport?: (item: IProcessedItem) => void;
    fixLanguages: boolean;
    canImport?: {
        contentItem?: (item: IImportContentItem) => boolean | Promise<boolean>;
        asset?: (item: IExportedAsset) => boolean | Promise<boolean>;
    };
}

export interface IImportAllResult {
    metadata: {
        timestamp: Date;
        projectId: string;
    };
}

export interface IPreparedImportItem<TItem> {
    type: ItemType;
    codename: string;
    item: TItem;
    deps: string[];
}

export interface IImportAsset {
    binaryData: any;
    assetId: string;
    filename: string;
    mimeType: string | undefined;
    extension: string | undefined;
}

export interface IImportSource {
    importData: {
        items: IImportContentItem[];
        assets: IImportAsset[];
    };
    metadata: IPackageMetadata;
}

export interface IImportData {
    orderedImportItems: IPreparedImportItem<any>[];
}

export interface IFlattenedFolder {
    name: string;
    externalId?: string;
    id: string;
}

export interface IImportContentItemElement {
    value: string;
    type: ElementType;
    codename: string;
}

export interface IImportContentItem {
    codename: string;
    name: string;
    language: string;
    type: string;
    collection: string;
    last_modified: string;
    workflow_step?: string;

    [prop: string]: any;

    elements: IImportContentItemElement[];
}
