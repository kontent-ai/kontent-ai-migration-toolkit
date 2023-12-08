import { IExportContentItem, IExportAsset } from '../export/index.js';
import { IImportContentType, IParsedAsset, IParsedContentItem } from '../import/index.js';
import { ZipService } from './zip-service.js';

/**
 * Browser is currently not generally upported as we depend on few node.js specific APIs
 */
export type ZipContext = 'node.js' | 'browser';

export type BinaryData = Blob | Buffer;

export type ProcessingFormat = 'csv' | 'json' | 'jsonJoined';

export type ZipCompressionLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface IItemFormatService {
    name: string;

    transformContentItemsAsync(items: IExportContentItem[]): Promise<IFileData[]>;
    parseContentItemsAsync(text: string, types: IImportContentType[]): Promise<IParsedContentItem[]>;
}

export type AssetTransformData = {
    readonly zip: ZipService;
    readonly assets: IExportAsset[];
};

export type AssetParseData = {
    readonly zip: ZipService;
};

export interface IAssetFormatService {
    name: string;

    transformAssetsAsync(data: AssetTransformData): Promise<BinaryData>;
    parseAssetsAsync(data: AssetParseData): Promise<IParsedAsset[]>;
}

export interface IExtractedBinaryFileData {
    filename: string;
    assetId: string;
    extension: string;
    mimeType: string;
    binaryData: Buffer | Blob;
}

export interface IFileProcessorConfig {}

export interface IFileData {
    filename: string;
    data: string;
    itemsCount: number;
}
