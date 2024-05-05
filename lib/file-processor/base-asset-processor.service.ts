import { IMigrationAsset } from '../core/index.js';
import { IAssetFormatService, AssetsTransformData, FileBinaryData, AssetsParseData } from './file-processor.models.js';

export abstract class BaseAssetProcessorService implements IAssetFormatService {
    abstract name: string;
    abstract transformAssetsAsync(data: AssetsTransformData): Promise<FileBinaryData>;
    abstract parseAssetsAsync(data: AssetsParseData): Promise<IMigrationAsset[]>;

    protected getSystemAssetFields(): string[] {
        return ['codename', 'filename', 'extension', 'url', 'externalId', 'title', 'folder', 'collection'];
    }
}
