import { IParsedAsset } from '../import/index.js';
import { IAssetFormatService, AssetsTransformData, FileBinaryData, AssetsParseData } from './file-processor.models.js';

export abstract class BaseAssetProcessorService implements IAssetFormatService {
    abstract name: string;
    abstract transformAssetsAsync(data: AssetsTransformData): Promise<FileBinaryData>;
    abstract parseAssetsAsync(data: AssetsParseData): Promise<IParsedAsset[]>;

    protected getSystemAssetFields(): string[] {
        return ['assetId', 'filename', 'extension', 'url'];
    }
}
