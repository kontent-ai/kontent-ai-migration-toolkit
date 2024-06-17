import { MigrationAsset } from '../../core/index.js';
import { AssetsParseData, AssetsTransformData, FileBinaryData } from '../../zip/zip.models.js';
import { BaseAssetProcessorService } from './base-asset-processor.service.js';

type AssetRecord = Omit<MigrationAsset, 'binaryData'>;

export class AssetJsonProcessorService extends BaseAssetProcessorService {
    public readonly name: string = 'json';
    private readonly assetsFilename: string = 'assets.json';
    private readonly assetsBinaryFolderName: string = 'binary_data';

    async transformAsync(data: AssetsTransformData): Promise<FileBinaryData> {
        const assetRecords: AssetRecord[] = [];
        const binaryDataFolder = data.zip.addFolder(this.assetsBinaryFolderName);

        for (const exportAsset of data.assets) {
            const folderConfig = this.getAssetFolderConfig(exportAsset);
            const subfolder = binaryDataFolder.addFolder(folderConfig.subfolder);

            assetRecords.push({
                _zipFilename: folderConfig.fullPath,
                filename: exportAsset.filename,
                title: exportAsset.title,
                codename: exportAsset.codename,
                collection: exportAsset.collection,
                descriptions: exportAsset.descriptions
            });

            if (exportAsset.binaryData) {
                subfolder.addFile(exportAsset.filename, exportAsset.binaryData);
            }
        }

        data.zip.addFile(this.assetsFilename, JSON.stringify(assetRecords));
        return await data.zip.generateZipAsync();
    }

    async parseAsync(data: AssetsParseData): Promise<MigrationAsset[]> {
        const text = await data.zip.getFileContentAsync(this.assetsFilename);

        if (!text) {
            return [];
        }

        const assetRecords: AssetRecord[] = JSON.parse(text) as AssetRecord[];
        const parsedAssets: MigrationAsset[] = [];

        for (const assetRecord of assetRecords) {
            parsedAssets.push({
                ...assetRecord,
                binaryData: await data.zip.getBinaryDataAsync(`${assetRecord.filename}`)
            });
        }

        return parsedAssets;
    }

    private getAssetFolderConfig(asset: MigrationAsset): {
        subfolder: string;
        fullPath: string;
    } {
        const subfolder: string = asset.filename.slice(0, 3);

        return { subfolder: subfolder, fullPath: `${this.assetsBinaryFolderName}/${subfolder}/${asset._zipFilename}` };
    }
}
