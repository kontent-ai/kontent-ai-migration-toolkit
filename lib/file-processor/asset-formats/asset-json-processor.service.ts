import { IParsedAsset, IParsedAssetRecord } from '../../import/index.js';
import { AssetParseData, AssetTransformData, BinaryData } from '../file-processor.models.js';
import { BaseAssetProcessorService } from '../base-asset-processor.service.js';

export class AssetJsonProcessorService extends BaseAssetProcessorService {
    public readonly name: string = 'json';
    private readonly assetsFilename: string = 'assets.json';

    async transformAssetsAsync(data: AssetTransformData): Promise<BinaryData> {
        const assetRecords: IParsedAssetRecord[] = [];

        for (const exportAsset of data.assets) {
            assetRecords.push({
                assetId: exportAsset.assetId,
                extension: exportAsset.extension,
                filename: exportAsset.filename,
                url: exportAsset.url
            });

            await data.zip.addFile(
                this.getAssetZipFilename(exportAsset.assetId, exportAsset.extension),
                exportAsset.binaryData
            );
        }

        data.zip.addFile(this.assetsFilename, JSON.stringify(assetRecords));

        return await data.zip.generateZipAsync();
    }
    async parseAssetsAsync(data: AssetParseData): Promise<IParsedAsset[]> {
        const text = await data.zip.getFileContentAsync(this.assetsFilename);

        if (!text) {
            return [];
        }

        const assetRecords: IParsedAssetRecord[] = JSON.parse(text);
        const parsedAssets: IParsedAsset[] = [];

        for (const assetRecord of assetRecords) {
            parsedAssets.push({
                ...assetRecord,
                binaryData: await data.zip.getBinaryDataAsync(
                    this.getAssetZipFilename(assetRecord.assetId, assetRecord.extension)
                )
            });
        }

        return parsedAssets;
    }

    private getAssetZipFilename(assetId: string, extension: string): string {
        return `${assetId}.${extension}`; // use id as filename to prevent filename conflicts
    }
}
