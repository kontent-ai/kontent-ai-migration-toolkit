import { EnvContext, MigrationAsset, MigrationItem } from '../core/index.js';
import { ZipPackage } from './zip-package.class.js';

export type ZipContext = EnvContext;
export type FileBinaryData = Blob | Buffer;
export type DefaultFormats = 'json';
export type ZipCompressionLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type ItemsTransformData = {
    readonly zip: ZipPackage;
    readonly items: MigrationItem[];
};

export type ItemsParseData = {
    readonly zip: ZipPackage;
};

export type ItemsFormat = ItemFormatService | DefaultFormats;
export type AssetsFormat = AssetFormatService | DefaultFormats;

export interface ItemFormatService {
    name: string;
    transformAsync(data: ItemsTransformData): Promise<FileBinaryData>;
    parseAsync(data: ItemsParseData): Promise<MigrationItem[]>;
}

export type AssetsTransformData = {
    readonly zip: ZipPackage;
    readonly assets: MigrationAsset[];
};

export type AssetsParseData = {
    readonly zip: ZipPackage;
};

export interface AssetFormatService {
    readonly name: string;
    transformAsync(data: AssetsTransformData): Promise<FileBinaryData>;
    parseAsync(data: AssetsParseData): Promise<MigrationAsset[]>;
}

export interface FilesConfig {
    readonly items: {
        readonly filename: string;
        readonly format: ItemsFormat;
    };
    readonly assets: {
        readonly filename: string;
        readonly format: AssetsFormat;
    };
}
