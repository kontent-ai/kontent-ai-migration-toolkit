import { IContentType } from '@kontent-ai/delivery-sdk';
import { IImportContentItem } from '../import';

export type ZipContext = 'node.js' | 'browser';

export type ExportFormat = 'csv' | 'json';

export interface IFormatService {
    mapLanguageVariantsAsync(
        types: IContentType[],
        items: ILanguageVariantDataModel[]
    ): Promise<ILanguageVariantsTypeDataWrapper[]>;

    parseImportItemsAsync(text: string): Promise<IImportContentItem[]>;
}

export interface IFileProcessorConfig {
    context: ZipContext;
    delayBetweenAssetDownloadRequestsMs?: number;
}

export interface ILanguageVariantDataModel {
    codename: string;
    name: string;
    language: string;
    type: string;
    collection: string;
    last_modified: string;
    workflow_step?: string;

    [elementCodename: string]: any;
}

export interface ILanguageVariantsTypeDataWrapper {
    contentType: IContentType;
    filename: string;
    data: string;
}

export interface IAssetDetailModel {
    assetId: string;
    filename: string;
}
