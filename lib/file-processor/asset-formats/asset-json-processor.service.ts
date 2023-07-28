import { IExportedAsset } from '../../export';
import { IParsedAsset } from '../../import';
import { IFileData } from '../file-processor.models';
import { BaseAssetProcessorService } from '../base-asset-processor.service';

export class AssetJsonProcessorService extends BaseAssetProcessorService {
    public readonly name: string = 'json';

    async transformAssetsAsync(assets: IExportedAsset[]): Promise<IFileData[]> {
        return [
            {
                filename: 'assets.json',
                data: JSON.stringify(
                    assets.map((m) => {
                        const parsedAsset: IParsedAsset = {
                            assetId: m.assetId,
                            extension: m.extension,
                            filename: m.filename,
                            url: m.url
                        };

                        return parsedAsset;
                    })
                )
            }
        ];
    }
    async parseAssetsAsync(text: string): Promise<IParsedAsset[]> {
        return JSON.parse(text) as IParsedAsset[];
    }
}
