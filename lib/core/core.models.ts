export interface ICliFileConfig {
    projectId: string;
    apiKey: string;
    action: CliAction;
    filename: string;
    baseUrl?: string;
    exportTypes?: string[];
    exportAssets: boolean;
}

export type CliAction = 'backup' | 'restore';
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
    timestamp: Date;
    dataOverview: IPackageDataOverview;
    csvManagerVersion: string;
}

export interface IPackageDataOverview {
    contentItemsCount: number;
    assetsCount: number;
}
