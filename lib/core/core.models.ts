import {
    AssetModels,
    ContentItemModels,
    ElementContracts,
    ElementModels,
    LanguageVariantModels
} from '@kontent-ai/management-sdk';
import { ProcessingFormat } from '../file-processor/index.js';
import { IParsedAsset, IParsedContentItem } from '../import/index.js';
import { ContentItemElementsIndexer, IContentItem, IContentType } from '@kontent-ai/delivery-sdk';

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
    replaceInvalidLinks: boolean;
    action: CliAction;
    itemsFilename?: string;
    assetsFilename?: string;
    baseUrl?: string;
    exportTypes?: string[];
    exportLanguages?: string[];
    exportAssets: boolean;
}

export type CliAction = 'export' | 'import';
export type ExportAdapter = 'kontentAi';
export type ItemType = 'component' | 'contentItem' | 'languageVariant' | 'asset' | 'binaryFile' | 'zipFile' | 'count';

export type ActionType =
    | 'skip'
    | 'save'
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

export type ContentElementType = ElementModels.ElementType;

export interface IProcessedItem {
    title: string;
    actionType: ActionType;
    itemType: ItemType;
    data: any;
}

export interface IImportedData {
    assets: {
        original: IParsedAsset;
        imported: AssetModels.Asset;
    }[];
    contentItems: {
        original: IParsedContentItem;
        imported: ContentItemModels.ContentItem;
    }[];
    languageVariants: {
        original: IParsedContentItem;
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
    config: IExportTransformConfig;
}) => string | string[] | undefined;

export type ImportTransformFunc = (data: {
    value: string | string[] | undefined;
    elementCodename: string;
    importedData: IImportedData;
    sourceItems: IParsedContentItem[];
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
    partA?: string;
}
