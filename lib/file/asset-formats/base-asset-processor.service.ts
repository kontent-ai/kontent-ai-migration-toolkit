import { MigrationAsset } from '../../core/index.js';
import { AssetFormatService, AssetsTransformData, FileBinaryData, AssetsParseData } from '../../zip/zip.models.js';

export abstract class BaseAssetProcessorService implements AssetFormatService {
    abstract readonly name: string;
    abstract transformAsync(data: AssetsTransformData): Promise<FileBinaryData>;
    abstract parseAsync(data: AssetsParseData): Promise<MigrationAsset[]>;
}
