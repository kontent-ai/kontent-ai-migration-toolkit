import { IMigrationAsset } from '../../core/index.js';
import { IAssetFormatService, AssetsTransformData, FileBinaryData, AssetsParseData } from '../../zip/zip.models.js';

export abstract class BaseAssetProcessorService implements IAssetFormatService {
    abstract readonly name: string;
    abstract transformAsync(data: AssetsTransformData): Promise<FileBinaryData>;
    abstract parseAsync(data: AssetsParseData): Promise<IMigrationAsset[]>;
}
