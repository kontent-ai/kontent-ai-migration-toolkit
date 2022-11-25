import { IContentType } from '@kontent-ai/delivery-sdk';

export type ZipContext = 'node.js' | 'browser';

export interface IFileProcessorConfig {
    context: ZipContext;
    delayBetweenAssetDownloadRequestsMs?: number;
}

export interface ILanguageVariantCsvModel {
    codename: string;
    name: string;
    language: string;
    type: string;
    collection: string;
    last_modified: string;
    workflow_step?: string;

    [elementCodename: string]: any;
}

export interface ILanguageVariantsTypeCsvWrapper {
    contentType: IContentType;
    csvFilename: string;
    csv: string;
}

export interface IAssetDetailModel {
    assetId: string;
    filename: string;
}
