import { AssetModels, ContentItemModels, ContentTypeElements, LanguageVariantModels } from '@kontent-ai/management-sdk';
import { MigrationElementType } from './migration.models.js';

export type TargetItemState = 'exists' | 'doesNotExists';
export type CliAction = 'export' | 'import' | 'migrate';
export type ExportAdapter = 'kontentAi';
export type GeneralItemType = 'exportedItem' | 'migrationItem';
export type GeneralActionType = 'readFs' | 'skip' | 'writeFs' | 'download';

export type MapiAction =
    | 'list'
    | 'view'
    | 'archive'
    | 'unpublish'
    | 'changeWorkflowStep'
    | 'publish'
    | 'upload'
    | 'create'
    | 'upsert'
    | 'createNewVersion';

export type MapiType =
    | 'contentType'
    | 'asset'
    | 'contentTypeSnippet'
    | 'contentItem'
    | 'languageVariant'
    | 'language'
    | 'collection'
    | 'taxonomy'
    | 'binaryFile'
    | 'workflow';

export interface IItemInfo {
    title: string;
    itemType: GeneralItemType | MapiType;
}

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
    itemCodename: string;
    item: ContentItemModels.ContentItem | undefined;
    externalIdToUse: string;
}

export interface ILanguageVariantStateInTargetEnvironmentByCodename {
    state: TargetItemState;
    itemCodename: string;
    languageCodename: string;
    languageVariant: LanguageVariantModels.ContentItemLanguageVariant | undefined;
}

export interface IAssetStateInTargetEnvironmentByCodename {
    state: TargetItemState;
    assetCodename: string;
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
