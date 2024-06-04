import { AssetModels, ContentItemModels, ContentTypeElements } from '@kontent-ai/management-sdk';
import { MigrationElementType } from './migration.models.js';

export type TargetItemState = 'exists' | 'doesNotExists';
export type CliAction = 'export' | 'import' | 'migrate';
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
    | 'viewAssetById'
    | 'viewAssetByCodename'
    | 'viewContentItemById'
    | 'viewContentItemByCodename'
    | 'upsert'
    | 'upload'
    | 'viewLanguageVariant'
    | 'publish'
    | 'changeWorkflowStep'
    | 'createNewVersion'
    | 'getById'
    | 'create'
    | 'publish'
    | 'unArchive'
    | 'extractBinaryData'
    | 'update';

export type FetchItemType =
    | 'content types'
    | 'content type snippets'
    | 'languages'
    | 'workflows'
    | 'collections'
    | 'taxonomies';

export interface IErrorData {
    message: string;
    requestData?: string;
    requestUrl?: string;
    isUnknownError: boolean;
    error: any;
}

export interface IReferencedDataInMigrationItems {
    itemCodenames: string[];
    assetCodenames: string[];
}

export interface IReferencedDataInLanguageVariants {
    itemIds: string[];
    assetIds: string[];
}

export interface IItemStateInSourceEnvironmentById {
    state: TargetItemState;
    id: string;
    item: ContentItemModels.ContentItem | undefined;
}

export interface IAssetStateInSourceEnvironmentById {
    state: TargetItemState;
    id: string;
    asset: AssetModels.Asset | undefined;
}

export interface IItemStateInTargetEnvironmentByCodename {
    state: TargetItemState;
    codename: string;
    item: ContentItemModels.ContentItem | undefined;
    externalIdToUse: string;
}

export interface IAssetStateInTargetEnvironmentByCodename {
    state: TargetItemState;
    codename: string;
    asset: AssetModels.Asset | undefined;
    externalIdToUse: string;
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

export interface IFlattenedContentTypeElement {
    codename: string;
    id: string;
    type: MigrationElementType;
    element: ContentTypeElements.ContentTypeElementModel;
}

export interface IFlattenedContentType {
    contentTypeCodename: string;
    contentTypeId: string;
    elements: IFlattenedContentTypeElement[];
}
