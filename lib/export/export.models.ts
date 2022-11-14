import {
    AssetContracts,
    ContentItemContracts,
    ContentTypeContracts,
    LanguageContracts,
    LanguageVariantContracts,
    ProjectContracts} from '@kontent-ai/management-sdk';
import { IRetryStrategyOptions } from '@kontent-ai/core-sdk';

import { IProcessedItem, IPackageMetadata, ItemType } from '../core';

export interface IExportConfig {
    projectId: string;
    apiKey: string;
    baseUrl?: string;
    onExport?: (item: IProcessedItem) => void;
    exportFilter?: ItemType[];
    skipValidation: boolean;
    retryStrategy?: IRetryStrategyOptions;
}

export interface IExportData {
    contentItems: ContentItemContracts.IContentItemModelContract[];
    languageVariants: LanguageVariantContracts.ILanguageVariantModelContract[];
    assets: AssetContracts.IAssetModelContract[];
    contentTypes: ContentTypeContracts.IContentTypeContract[];
    languages: LanguageContracts.ILanguageModelContract[];
}

export interface IExportAllResult {
    metadata: IPackageMetadata;
    data: IExportData;
    validation: ProjectContracts.IProjectReportResponseContract | string;
}
