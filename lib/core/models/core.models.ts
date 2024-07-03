import {
    AssetModels,
    ContentItemModels,
    ContentTypeElements,
    LanguageVariantModels,
    WorkflowModels
} from '@kontent-ai/management-sdk';
import { MigrationElementType } from './migration.models.js';
import { WorkflowStep } from '../helpers/workflow-helper.js';

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
    readonly itemCodenames: ReadonlySet<string>;
    readonly assetCodenames: ReadonlySet<string>;
}

export interface ReferencedDataInLanguageVariants {
    readonly itemIds: ReadonlySet<string>;
    readonly assetIds: ReadonlySet<string>;
}

export interface ItemStateInSourceEnvironmentById {
    readonly state: TargetItemState;
    readonly id: string;
    readonly item: Readonly<ContentItemModels.ContentItem> | undefined;
}

export interface AssetStateInSourceEnvironmentById {
    readonly state: TargetItemState;
    readonly id: string;
    readonly asset: Readonly<AssetModels.Asset> | undefined;
}

export interface ItemStateInTargetEnvironmentByCodename {
    readonly state: TargetItemState;
    readonly itemCodename: string;
    readonly item: Readonly<ContentItemModels.ContentItem> | undefined;
    readonly externalIdToUse: string;
}

export interface LanguageVariantStateInTargetEnvironmentByCodename {
    readonly state: TargetItemState;
    readonly itemCodename: string;
    readonly languageCodename: string;
    readonly languageVariant: Readonly<LanguageVariantModels.ContentItemLanguageVariant> | undefined;
    readonly workflow: Readonly<WorkflowModels.Workflow> | undefined;
    readonly step: Readonly<WorkflowStep> | undefined;
}

export interface AssetStateInTargetEnvironmentByCodename {
    readonly state: TargetItemState;
    readonly assetCodename: string;
    readonly asset: Readonly<AssetModels.Asset> | undefined;
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
    readonly element: Readonly<ContentTypeElements.ContentTypeElementModel>;
}

export interface FlattenedContentType {
    readonly contentTypeCodename: string;
    readonly contentTypeId: string;
    readonly elements: readonly FlattenedContentTypeElement[];
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
