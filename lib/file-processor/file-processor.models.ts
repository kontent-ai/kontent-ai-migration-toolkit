import { IContentItem, IContentType } from '@kontent-ai/delivery-sdk';
import { IExportedAsset } from '../export';
import { IParsedAsset, IParsedContentItem as IParsedContentItem } from '../import';

/**
 * Browser is currently not generally upported as we depend on few node.js specific APIs
 */
export type ZipContext = 'node.js' | 'browser';

export type ExportFormat = 'csv' | 'json';

export type ZipCompressionLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface IFormatService {
    name: string;

    transformLanguageVariantsAsync(types: IContentType[], items: IContentItem[]): Promise<IFileData[]>;
    parseContentItemsAsync(text: string): Promise<IParsedContentItem[]>;
    transformAssetsAsync(assets: IExportedAsset[]): Promise<IFileData[]>;
    parseAssetsAsync(text: string): Promise<IParsedAsset[]>;
}

export interface IExtractedBinaryFileData {
    filename: string;
    assetId: string;
    extension: string;
    mimeType: string;
    binaryData: Buffer | Blob;
}

export interface IFileProcessorConfig {
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

export interface IFileData {
    filename: string;
    data: string;
}
