import { AssetContracts, ContentItemContracts, LanguageVariantContracts } from '@kontent-ai/management-sdk';
import { IRetryStrategyOptions } from '@kontent-ai/core-sdk';

import { IProcessedItem, ItemType, IPackageMetadata } from '../core';

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
        contentItem?: (item: ContentItemContracts.IContentItemModelContract) => boolean | Promise<boolean>;
        languageVariant?: (item: LanguageVariantContracts.ILanguageVariantModelContract) => boolean | Promise<boolean>;
        asset?: (item: AssetContracts.IAssetModelContract) => boolean | Promise<boolean>;
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
        contentItems: ContentItemContracts.IContentItemModelContract[];
        languageVariants: LanguageVariantContracts.ILanguageVariantModelContract[];
        assets: AssetContracts.IAssetModelContract[];
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
