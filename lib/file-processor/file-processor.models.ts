import { IExportContentItem, IExportAsset } from '../export/index.js';
import { IImportContentType, IParsedAsset, IParsedContentItem } from '../import/index.js';
import { ZipPackage } from './zip-package.class.js';

/**
 * Browser is currently not generally upported as we depend on few node.js specific APIs
 */
export type ZipContext = 'node.js' | 'browser';

export type FileBinaryData = Blob | Buffer;

export type ProcessingFormat = 'csv' | 'json' | 'jsonJoined';

export type ZipCompressionLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type ItemsTransformData = {
    readonly zip: ZipPackage;
    readonly items: IExportContentItem[];
};

export type ItemsParseData = {
    readonly zip: ZipPackage;
    readonly types: IImportContentType[];
};

export interface IItemFormatService {
    name: string;
    transformContentItemsAsync(data: ItemsTransformData): Promise<FileBinaryData>;
    parseContentItemsAsync(data: ItemsParseData): Promise<IParsedContentItem[]>;
}

export type AssetsTransformData = {
    readonly zip: ZipPackage;
    readonly assets: IExportAsset[];
};

export type AssetsParseData = {
    readonly zip: ZipPackage;
};

export interface IAssetFormatService {
    name: string;
    transformAssetsAsync(data: AssetsTransformData): Promise<FileBinaryData>;
    parseAssetsAsync(data: AssetsParseData): Promise<IParsedAsset[]>;
}

export interface IExtractedBinaryFileData {
    filename: string;
    assetId: string;
    extension: string;
    mimeType: string;
    binaryData: Buffer | Blob;
}

