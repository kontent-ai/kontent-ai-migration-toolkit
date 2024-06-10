import { EnvContext, IMigrationAsset, IMigrationItem } from '../core/index.js';
import { ZipPackage } from './zip-package.class.js';

export type ZipContext = EnvContext;
export type FileBinaryData = Blob | Buffer;
export type DefaultFormats = 'json';
export type ZipCompressionLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type ItemsTransformData = {
    readonly zip: ZipPackage;
    readonly items: IMigrationItem[];
};

export type ItemsParseData = {
    readonly zip: ZipPackage;
};

export type ItemsFormat = IItemFormatService | DefaultFormats;
export type AssetsFormat = IAssetFormatService | DefaultFormats;

export interface IItemFormatService {
    name: string;
    transformAsync(data: ItemsTransformData): Promise<FileBinaryData>;
    parseAsync(data: ItemsParseData): Promise<IMigrationItem[]>;
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
    transformAsync(data: AssetsTransformData): Promise<FileBinaryData>;
    parseAsync(data: AssetsParseData): Promise<IMigrationAsset[]>;
}

export interface IExtractedBinaryFileData {
    filename: string;
    assetId: string;
    extension: string;
    mimeType: string;
    binaryData: Buffer | Blob;
}
