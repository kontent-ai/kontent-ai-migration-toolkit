import { FileBinaryData, ZipPackager } from './zip.models.js';
import { Logger, MigrationAsset, MigrationData, MigrationItem, getDefaultLogger, mapAsync } from '../core/index.js';
import chalk from 'chalk';

type ZipAssetRecord = Omit<MigrationAsset, 'binaryData'> & {
    _zipFilename: string;
};

export function zipTransformer(zip: ZipPackager, logger?: Logger) {
    const loggerToUse: Logger = logger ?? getDefaultLogger();
    const filename: string = 'items.json';
    const assetsFilename: string = 'assets.json';
    const assetsBinaryFolderName: string = 'binary_data';

    const getAssetFolderConfig = (asset: MigrationAsset): { partialColder: string; fullPath: string } => {
        const codenamePartialFolder: string = asset.codename.slice(0, 2);
        return {
            partialColder: codenamePartialFolder,
            fullPath: `${assetsBinaryFolderName}/${codenamePartialFolder}/${asset.codename}/${asset.filename}`
        };
    };

    const transformItems = (items: readonly MigrationItem[]): void => {
        zip.addFile(filename, items.length ? JSON.stringify(items) : '[]');
    };

    const transformAssets = (assets: readonly MigrationAsset[]): void => {
        const assetRecords: ZipAssetRecord[] = [];
        const binaryDataFolder = zip.addFolder(assetsBinaryFolderName);

        assets.forEach((asset) => {
            const folderConfig = getAssetFolderConfig(asset);
            const partialFolder = binaryDataFolder.addFolder(folderConfig.partialColder);
            const codenameFolder = partialFolder.addFolder(asset.codename);

            assetRecords.push({
                _zipFilename: folderConfig.fullPath,
                filename: asset.filename,
                title: asset.title,
                codename: asset.codename,
                collection: asset.collection,
                descriptions: asset.descriptions
            });

            if (asset.binaryData) {
                codenameFolder.addFile(asset.filename, asset.binaryData);
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

        const assetRecords = JSON.parse(text) as ZipAssetRecord[];

        return await mapAsync(assetRecords, async (assetRecord) => {
            const binaryFile = await zip.getBinaryDataAsync(`${assetRecord._zipFilename}`);

            if (!binaryFile) {
                throw Error(`Could not load binary data for file '${chalk.red(assetRecord._zipFilename)}'`);
            }

            const migrationAsset: MigrationAsset = {
                codename: assetRecord.codename,
                filename: assetRecord.filename,
                collection: assetRecord.collection,
                title: assetRecord.title,
                descriptions: assetRecord.descriptions,
                binaryData: binaryFile
            };

            return migrationAsset;
        });
    };

    return {
        async transformAsync(data: MigrationData): Promise<FileBinaryData> {
            transformItems(data.items);
            transformAssets(data.assets);

            return await zip.generateZipAsync({ logger: loggerToUse });
        },
        async parseAsync(): Promise<MigrationData> {
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
