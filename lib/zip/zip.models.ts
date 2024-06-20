import { EnvContext, MigrationAsset, MigrationItem } from '../core/index.js';

export type ZipContext = EnvContext;
export type FileBinaryData = Buffer | Blob;
export type DefaultFormats = 'json';
export type ZipCompressionLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type TransformData = {
    readonly items: MigrationItem[];
    readonly assets: MigrationAsset[];
};
