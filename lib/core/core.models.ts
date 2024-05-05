import {
    AssetModels,
    CollectionModels,
    ContentItemModels,
    ContentTypeElements,
    ElementContracts,
    LanguageModels,
    SharedModels,
    TaxonomyModels,
    WorkflowModels
} from '@kontent-ai/management-sdk';
import { IAssetFormatService, IItemFormatService, ProcessingFormat } from '../file-processor/index.js';
import { IMigrationItem, MigrationElementType } from './migration-models.js';
import { IKontentAiPreparedExportItem } from 'lib/export/export.models.js';

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

export interface IImportContext {
    componentItems: IMigrationItem[];
    contentItems: IMigrationItem[];
    referencedData: IReferencedDataInMigrationItems;
    itemsInTargetEnvironment: IItemStateInTargetEnvironmentByCodename[];
    getItemStateInTargetEnvironment: (codename: string) => IItemStateInTargetEnvironmentByCodename;
    getAssetStateInTargetEnvironment: (codename: string) => IAssetStateInTargetEnvironmentByCodename;
}

export interface IExportContextEnvironmentData {
    languages: LanguageModels.LanguageModel[];
    contentTypes: IFlattenedContentType[];
    collections: CollectionModels.Collection[];
    workflows: WorkflowModels.Workflow[];
    taxonomies: TaxonomyModels.Taxonomy[];
}

export interface IExportContext {
    environmentData: IExportContextEnvironmentData;
    referencedData: IReferencedDataInLanguageVariants;
    getItemStateInSourceEnvironment: (id: string) => IItemStateInSourceEnvironmentById;
    getAssetStateInSourceEnvironment: (id: string) => IAssetStateInSourceEnvironmentById;
    preparedExportItems: IKontentAiPreparedExportItem[];
}

export type TargetItemState = 'exists' | 'doesNotExists';

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

export type ExportTransformFunc = (data: {
    exportItem: IKontentAiPreparedExportItem;
    typeElement: IFlattenedContentTypeElement;
    value: string | number | SharedModels.ReferenceObject[] | undefined;
    context: IExportContext;
}) => string | string[] | undefined;

export type ImportTransformFunc = (data: {
    value: string | string[] | undefined;
    elementCodename: string;
    importContext: IImportContext;
    sourceItems: IMigrationItem[];
}) => Promise<ElementContracts.IContentItemElementContract>;

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
