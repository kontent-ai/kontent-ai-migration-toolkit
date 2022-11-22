import { IExportFilter } from 'lib/export';

export interface ICliFileConfig {
    projectId: string;
    apiKey: string;
    action: CliAction;
    zipFilename: string;
    enableLog: boolean;
    preserveWorkflow: boolean;
    baseUrl?: string;
    exportFilter?: IExportFilter;
    skipValidation?: boolean;
}

export type CliAction = 'backup' | 'restore' | 'clean';
export type ItemType = 'component' | 'contentItem' | 'languageVariant' | 'asset' | 'binaryFile';

export type ActionType =
    | 'skipUpdate'
    | 'archive'
    | 'upsert'
    | 'upload'
    | 'publish'
    | 'changeWorkflowStep'
    | 'createNewVersion'
    | 'fetch'
    | 'create'
    | 'publish'
    | 'update';

export interface IProcessedItem {
    title: string;
    actionType: ActionType;
    itemType: ItemType;
    data: any;
}

export interface IImportItemResult {
    original: any;
    imported: any;

    originalId?: string;
    originalCodename?: string;
    importId?: string;
}

export interface IIdCodenameTranslationResult {
    [key: string]: string;
}

export interface IPackageMetadata {
    projectId: string;
    projectName: string;
    environment: string;
    timestamp: Date;
    dataOverview: IPackageDataOverview;
    csvManagerVersion: string;
}

export interface IPackageDataOverview {
    contentItemsCount: number;
    assetsCount: number;
}
