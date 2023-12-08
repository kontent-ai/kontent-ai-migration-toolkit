import { IParsedAsset } from '../import/index.js';
import { IAssetFormatService, AssetTransformData, BinaryData, AssetParseData } from './file-processor.models.js';

export abstract class BaseAssetProcessorService implements IAssetFormatService {
    abstract name: string;
    abstract transformAssetsAsync(data: AssetTransformData): Promise<BinaryData>;
    abstract parseAssetsAsync(data: AssetParseData): Promise<IParsedAsset[]>;

    protected getSystemAssetFields(): string[] {
        return ['assetId', 'filename', 'extension', 'url'];
    }
}
