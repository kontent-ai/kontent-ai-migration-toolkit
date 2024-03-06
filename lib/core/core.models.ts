import { AssetModels, ContentItemModels, ElementContracts, LanguageVariantModels } from '@kontent-ai/management-sdk';
import { IAssetFormatService, IItemFormatService, ProcessingFormat } from '../file-processor/index.js';
import { ContentItemElementsIndexer, IContentItem, IContentType } from '@kontent-ai/delivery-sdk';
import { IMigrationItem, IMigrationAsset } from './migration-models.js';

export interface ICliFileConfig {
    adapter?: ExportAdapter;
    environmentId?: string;
    previewApiKey?: string;
    secureApiKey?: string;
    managementApiKey?: string;
    format: ProcessingFormat;
    isPreview: boolean;
    isSecure: boolean;
    skipFailedItems: boolean;
    contentItemsFetchMode?: ContentItemsFetchMode;
    replaceInvalidLinks: boolean;
    action: CliAction;
    itemsFilename?: string;
    assetsFilename?: string;
    baseUrl?: string;
    exportTypes?: string[];
    exportLanguages?: string[];
    force: boolean;
}

export type CliAction = 'export' | 'import';
export type ExportAdapter = 'kontentAi';
export type ItemType =
    | 'component'
    | 'contentItem'
    | 'listContentItems'
    | 'languageVariant'
    | 'asset'
    | 'binaryFile'
    | 'zipFile'
    | 'count';
export type ContentItemsFetchMode = 'oneByOne' | 'listAll';

export type ActionType =
    | 'skip'
    | 'save'
    | 'unpublish'
    | 'readFs'
    | 'writeFs'
    | 'download'
    | 'zip'
    | 'read'
    | 'archive'
    | 'upsert'
    | 'upload'
    | 'publish'
    | 'changeWorkflowStep'
    | 'createNewVersion'
    | 'fetch'
    | 'create'
    | 'publish'
    | 'unArchive'
    | 'extractBinaryData'
    | 'update';

export interface IErrorData {
    message: string;
    requestData?: string;
    requestUrl?: string;
    isUnknownError: boolean;
    error: any;
}

export interface IProcessedItem {
    title: string;
    actionType: ActionType;
    itemType: ItemType;
    data: any;
}

export interface IImportedData {
    assets: {
        original: IMigrationAsset;
        imported: AssetModels.Asset;
    }[];
    contentItems: {
        original: IMigrationItem;
        imported: ContentItemModels.ContentItem;
    }[];
    languageVariants: {
        original: IMigrationItem;
        imported: LanguageVariantModels.ContentItemLanguageVariant;
    }[];
}

export interface IIdCodenameTranslationResult {
    [key: string]: string;
}

export interface IPackageMetadata {
    created: Date;
    environmentId: string;
    dataOverview: IPackageDataOverview;
}

export interface IPackageDataOverview {
    contentItemsCount: number;
    assetsCount: number;
}

export type ExportTransformFunc = (data: {
    element: ContentItemElementsIndexer;
    item: IContentItem;
    items: IContentItem[];
    types: IContentType[];
    assets: AssetModels.Asset[];
    config: IExportTransformConfig;
}) => string | string[] | undefined;

export type ImportTransformFunc = (data: {
    value: string | string[] | undefined;
    elementCodename: string;
    importedData: IImportedData;
    sourceItems: IMigrationItem[];
}) => ElementContracts.IContentItemElementContract;

export interface IExportTransformConfig {
    richTextConfig: IRichTextExportConfig;
}

export interface IRichTextExportConfig {
    replaceInvalidLinks: boolean;
}

export interface IChunk<T> {
    items: T[];
    index: number;
}

export interface IProcessInChunksItemInfo {
    title: string;
    itemType: ItemType;
}

export type ItemsFormatConfig = IItemFormatService | 'json' | 'csv';
export type AssetsFormatConfig = IAssetFormatService | 'json' | 'csv';
