import { AssetContracts } from '@kontent-ai/management-sdk';
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
    enableLog: boolean;
    preserveWorkflow: boolean;
    onUnsupportedBinaryFile?: (binaryFile: IBinaryFile) => void;
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

export interface IBinaryFile {
    binaryData: any;
    asset: AssetContracts.IAssetModelContract;
}

export interface IImportSource {
    importData: {
        items: IImportContentItem[];
        assets: IExportedAsset[];
    };
    metadata: IPackageMetadata;
    binaryFiles: IBinaryFile[];
}

export interface IImportData {
    orderedImportItems: IPreparedImportItem<any>[];
    binaryFiles: IBinaryFile[];
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
