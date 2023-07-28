import { IExportedAsset } from '../export';
import { IParsedAsset } from '../import';
import { IFileData, IAssetFormatService } from './file-processor.models';

export abstract class BaseAssetProcessorService implements IAssetFormatService {
    abstract name: string;
    abstract transformAssetsAsync(assets: IExportedAsset[]): Promise<IFileData[]>;
    abstract parseAssetsAsync(text: string): Promise<IParsedAsset[]>;

    protected getSystemAssetFields(): string[] {
        return ['assetId', 'filename', 'extension', 'url'];
    }
}
