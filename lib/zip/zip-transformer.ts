import { TransformData } from './zip.models.js';
import { MigrationAsset, MigrationItem } from '../core/index.js';
import { ZipPackage } from 'lib/zip/zip-package.class.js';

type AssetRecord = Omit<MigrationAsset, 'binaryData'>;

export function zipTransformer(zip: ZipPackage) {
    const filename: string = 'items.json';
    const assetsFilename: string = 'assets.json';
    const assetsBinaryFolderName: string = 'binary_data';

    const getAssetFolderConfig = (asset: MigrationAsset) => {
        const subfolder: string = asset.filename.slice(0, 3);
        return { subfolder: subfolder, fullPath: `${assetsBinaryFolderName}/${subfolder}/${asset._zipFilename}` };
    };

    const transformItems = (items: MigrationItem[]) => {
        zip.addFile(filename, items.length ? JSON.stringify(items) : '[]');
    };

    const transformAssets = (assets: MigrationAsset[]) => {
        const assetRecords: AssetRecord[] = [];
        const binaryDataFolder = zip.addFolder(assetsBinaryFolderName);

        for (const exportAsset of assets) {
            const folderConfig = getAssetFolderConfig(exportAsset);
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

        zip.addFile(assetsFilename, JSON.stringify(assetRecords));
    };

    const parseItems = async () => {
        const fileContent = await zip.getFileContentAsync(filename);
        return fileContent ? (JSON.parse(fileContent) as MigrationItem[]) : [];
    };

    const parseAssets = async () => {
        const text = await zip.getFileContentAsync(assetsFilename);

        if (!text) {
            return [];
        }

        const assetRecords: AssetRecord[] = JSON.parse(text) as AssetRecord[];
        const parsedAssets: MigrationAsset[] = [];

        for (const assetRecord of assetRecords) {
            parsedAssets.push({
                ...assetRecord,
                binaryData: await zip.getBinaryDataAsync(`${assetRecord.filename}`)
            });
        }

        return parsedAssets;
    };

    return {
        transformAsync: async (data: TransformData) => {
            transformItems(data.items);
            transformAssets(data.assets);

            return await zip.generateZipAsync();
        },
        parseAsync: async () => {
            const items = await parseItems();
            const assets = await parseAssets();

            const transformData: TransformData = {
                assets: assets,
                items: items
            };
            return transformData;
        }
    };
}
