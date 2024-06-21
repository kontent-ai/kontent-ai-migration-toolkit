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
    readonly title: string;
    readonly itemType: GeneralItemType | MapiType;
}

export interface ErrorData {
    readonly message: string;
    readonly requestData?: string;
    readonly requestUrl?: string;
    readonly isUnknownError: boolean;
    readonly error: unknown;
}

export interface ReferencedDataInMigrationItems {
    readonly itemCodenames: Set<string>;
    readonly assetCodenames: Set<string>;
}

export interface ReferencedDataInLanguageVariants {
    readonly itemIds: Set<string>;
    readonly assetIds: Set<string>;
}

export interface ItemStateInSourceEnvironmentById {
    readonly state: TargetItemState;
    readonly id: string;
    readonly item: ContentItemModels.ContentItem | undefined;
}

export interface AssetStateInSourceEnvironmentById {
    readonly state: TargetItemState;
    readonly id: string;
    readonly asset: AssetModels.Asset | undefined;
}

export interface ItemStateInTargetEnvironmentByCodename {
    readonly state: TargetItemState;
    readonly itemCodename: string;
    readonly item: ContentItemModels.ContentItem | undefined;
    readonly externalIdToUse: string;
}

export interface LanguageVariantStateInTargetEnvironmentByCodename {
    readonly state: TargetItemState;
    readonly itemCodename: string;
    readonly languageCodename: string;
    readonly languageVariant: LanguageVariantModels.ContentItemLanguageVariant | undefined;
}

export interface AssetStateInTargetEnvironmentByCodename {
    readonly state: TargetItemState;
    readonly assetCodename: string;
    readonly asset: AssetModels.Asset | undefined;
    readonly externalIdToUse: string;
}

export interface PackageMetadata {
    readonly created: Date;
    readonly environmentId: string;
    readonly dataOverview: PackageDataOverview;
}

export interface PackageDataOverview {
    readonly contentItemsCount: number;
    readonly assetsCount: number;
}

export interface FlattenedContentTypeElement {
    readonly codename: string;
    readonly id: string;
    readonly type: MigrationElementType;
    readonly element: ContentTypeElements.ContentTypeElementModel;
}

export interface FlattenedContentType {
    readonly contentTypeCodename: string;
    readonly contentTypeId: string;
    readonly elements: FlattenedContentTypeElement[];
}

export interface OriginalManagementError {
    response?: {
        status?: number;
        config?: {
            url?: string;
            data?: string;
        };
        data?: {
            error_code?: number;
        };
    };
}
