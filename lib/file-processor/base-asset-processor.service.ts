import { IExportedAsset } from '../export/index.js';
import { IParsedAsset } from '../import/index.js';
import { IFileData, IAssetFormatService } from './file-processor.models.js';

export abstract class BaseAssetProcessorService implements IAssetFormatService {
    abstract name: string;
    abstract transformAssetsAsync(assets: IExportedAsset[]): Promise<IFileData[]>;
    abstract parseAssetsAsync(text: string): Promise<IParsedAsset[]>;

    protected getSystemAssetFields(): string[] {
        return ['assetId', 'filename', 'extension', 'url'];
    }
}
