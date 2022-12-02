import { IContentItem, IContentType } from '@kontent-ai/delivery-sdk';
import { IImportContentItem as IParsedContentItem } from '../import';

export type ZipContext = 'node.js' | 'browser';

export type ExportFormat = 'csv' | 'json';

export interface IFormatService {
    name: string;

    transformLanguageVariantsAsync(
        types: IContentType[],
        items: IContentItem[]
    ): Promise<ILanguageVariantsDataWrapper[]>;

    parseContentItemsAsync(text: string): Promise<IParsedContentItem[]>;
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

export interface ILanguageVariantsDataWrapper {
    filename: string;
    data: string;
}

export interface IAssetDetailModel {
    assetId: string;
    filename: string;
}
