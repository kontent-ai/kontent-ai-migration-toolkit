import { IMigrationAsset, IMigrationItem } from '../core/index.js';
import { IImportContentType } from '../import/index.js';
import { ZipPackage } from './zip-package.class.js';

/**
 * Browser is currently not generally upported as we depend on few node.js specific APIs
 */
export type ZipContext = 'node.js' | 'browser';

export type FileBinaryData = Blob | Buffer;

export type ProcessingFormat = 'csv' | 'json';

export type ZipCompressionLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type ItemsTransformData = {
    readonly zip: ZipPackage;
    readonly items: IMigrationItem[];
};

export type ItemsParseData = {
    readonly zip: ZipPackage;
    readonly types: IImportContentType[];
};

export interface IItemFormatService {
    name: string;
    transformContentItemsAsync(data: ItemsTransformData): Promise<FileBinaryData>;
    parseContentItemsAsync(data: ItemsParseData): Promise<IMigrationItem[]>;
}

export type AssetsTransformData = {
    readonly zip: ZipPackage;
    readonly assets: IMigrationAsset[];
};

export type AssetsParseData = {
    readonly zip: ZipPackage;
};

export interface IAssetFormatService {
    name: string;
    transformAssetsAsync(data: AssetsTransformData): Promise<FileBinaryData>;
    parseAssetsAsync(data: AssetsParseData): Promise<IMigrationAsset[]>;
}

export interface IExtractedBinaryFileData {
    filename: string;
    assetId: string;
    extension: string;
    mimeType: string;
    binaryData: Buffer | Blob;
}
