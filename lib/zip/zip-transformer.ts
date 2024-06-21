import { ZipPackager } from './zip.models.js';
import { Logger, MigrationAsset, MigrationData, MigrationItem, getDefaultLogger, mapAsync } from '../core/index.js';

type AssetWithoutBinaryData = Omit<MigrationAsset, 'binaryData'>;

export function zipTransformer(zip: ZipPackager, logger?: Logger) {
    const loggerToUse: Logger = logger ?? getDefaultLogger();
    const filename: string = 'items.json';
    const assetsFilename: string = 'assets.json';
    const assetsBinaryFolderName: string = 'binary_data';

    const getAssetFolderConfig = (asset: MigrationAsset) => {
        const subfolder: string = asset.filename.slice(0, 3);
        return { subfolder: subfolder, fullPath: `${assetsBinaryFolderName}/${subfolder}/${asset._zipFilename}` };
    };

    const transformItems = (items: readonly MigrationItem[]) => {
        zip.addFile(filename, items.length ? JSON.stringify(items) : '[]');
    };

    const transformAssets = (assets: readonly MigrationAsset[]) => {
        const assetRecords: AssetWithoutBinaryData[] = [];
        const binaryDataFolder = zip.addFolder(assetsBinaryFolderName);

        assets.forEach((asset) => {
            const folderConfig = getAssetFolderConfig(asset);
            const subfolder = binaryDataFolder.addFolder(folderConfig.subfolder);

            assetRecords.push({
                _zipFilename: folderConfig.fullPath,
                filename: asset.filename,
                title: asset.title,
                codename: asset.codename,
                collection: asset.collection,
                descriptions: asset.descriptions
            });

            if (asset.binaryData) {
                subfolder.addFile(asset.filename, asset.binaryData);
            }
        });

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

        const assetRecords = JSON.parse(text) as AssetWithoutBinaryData[];

        return await mapAsync(assetRecords, async (assetRecord) => {
            const migrationAsset: MigrationAsset = {
                ...assetRecord,
                binaryData: await zip.getBinaryDataAsync(`${assetRecord._zipFilename}`)
            };

            return migrationAsset;
        });
    };

    return {
        transformAsync: async (data: MigrationData) => {
            transformItems(data.items);
            transformAssets(data.assets);

            return await zip.generateZipAsync({ logger: loggerToUse });
        },
        parseAsync: async () => {
            const items = await parseItems();
            const assets = await parseAssets();

            const migrationData: MigrationData = {
                assets: assets,
                items: items
            };
            return migrationData;
        }
    };
}
