import { AssetModels, ContentItemModels, ContentTypeElements, LanguageVariantModels } from '@kontent-ai/management-sdk';
import { MigrationElementType } from './migration.models.js';

export type TargetItemState = 'exists' | 'doesNotExists';
export type CliAction = 'export' | 'import' | 'migrate';
export type GeneralItemType = 'exportedItem' | 'migrationItem';
export type GeneralActionType = 'readFs' | 'skip' | 'writeFs' | 'download';
export type EnvContext = 'browser' | 'node';

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

export interface ItemInfo {
    title: string;
    itemType: GeneralItemType | MapiType;
}

export interface ErrorData {
    message: string;
    requestData?: string;
    requestUrl?: string;
    isUnknownError: boolean;
    error: any;
}

export interface ReferencedDataInMigrationItems {
    itemCodenames: string[];
    assetCodenames: string[];
}

export interface ReferencedDataInLanguageVariants {
    itemIds: string[];
    assetIds: string[];
}

export interface ItemStateInSourceEnvironmentById {
    state: TargetItemState;
    id: string;
    item: ContentItemModels.ContentItem | undefined;
}

export interface AssetStateInSourceEnvironmentById {
    state: TargetItemState;
    id: string;
    asset: AssetModels.Asset | undefined;
}

export interface ItemStateInTargetEnvironmentByCodename {
    state: TargetItemState;
    itemCodename: string;
    item: ContentItemModels.ContentItem | undefined;
    externalIdToUse: string;
}

export interface LanguageVariantStateInTargetEnvironmentByCodename {
    state: TargetItemState;
    itemCodename: string;
    languageCodename: string;
    languageVariant: LanguageVariantModels.ContentItemLanguageVariant | undefined;
}

export interface AssetStateInTargetEnvironmentByCodename {
    state: TargetItemState;
    assetCodename: string;
    asset: AssetModels.Asset | undefined;
    externalIdToUse: string;
}

export interface PackageMetadata {
    created: Date;
    environmentId: string;
    dataOverview: PackageDataOverview;
}

export interface PackageDataOverview {
    contentItemsCount: number;
    assetsCount: number;
}

export interface FlattenedContentTypeElement {
    codename: string;
    id: string;
    type: MigrationElementType;
    element: ContentTypeElements.ContentTypeElementModel;
}

export interface FlattenedContentType {
    contentTypeCodename: string;
    contentTypeId: string;
    elements: FlattenedContentTypeElement[];
}
