import { AssetModels, ContentItemModels, ElementModels, LanguageVariantModels } from '@kontent-ai/management-sdk';
import { ProcessingFormat } from '../file-processor';
import { IImportAsset, IParsedContentItem } from '../import';

export interface ICliFileConfig {
    environmentId: string;
    previewApiKey?: string;
    secureApiKey?: string;
    managementApiKey?: string;
    format?: ProcessingFormat;
    isPreview: boolean;
    isSecure: boolean;
    skipFailedItems: boolean;
    action: CliAction;
    itemsFilename?: string;
    assetsFilename?: string;
    baseUrl?: string;
    exportTypes?: string[];
    exportAssets: boolean;
}

export type CliAction = 'export' | 'restore';
export type ItemType = 'component' | 'contentItem' | 'languageVariant' | 'asset' | 'binaryFile' | 'zipFile';

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
        original: IImportAsset;
        imported: AssetModels.Asset;
    }[];
    contentItems: {
        original: IParsedContentItem;
        imported: ContentItemModels.ContentItem;
    }[];

    languageVariants: {
        original: any;
        imported: LanguageVariantModels.ContentItemLanguageVariant;
    }[];
}

export interface IIdCodenameTranslationResult {
    [key: string]: string;
}

export interface IPackageMetadata {
    version: string;
    created: Date;
    environmentId: string;
    dataOverview: IPackageDataOverview;
}

export interface IPackageDataOverview {
    contentItemsCount: number;
    assetsCount: number;
}
