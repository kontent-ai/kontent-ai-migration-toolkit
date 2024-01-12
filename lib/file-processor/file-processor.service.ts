import colors from 'colors';
import JSZip from 'jszip';

import { IExportAdapterResult } from '../export/index.js';
import { IParsedContentItem, IImportSource, IImportContentType, IParsedAsset } from '../import/index.js';
import {
    IItemFormatService,
    ZipCompressionLevel,
    IAssetFormatService,
    FileBinaryData
} from './file-processor.models.js';
import { IExportTransformConfig, logDebug } from '../core/index.js';
import { ZipPackage } from './zip-package.class.js';

export class FileProcessorService {
    constructor() {}

    async parseZipAsync(data: {
        items?: {
            file: Buffer;
            formatService: IItemFormatService;
        };
        assets?: {
            file: Buffer;
            formatService: IAssetFormatService;
        };
        types: IImportContentType[];
    }): Promise<IImportSource> {
        const result: IImportSource = {
            importData: {
                items: [],
                assets: []
            }
        };

        if (data.items) {
            logDebug({
                type: 'info',
                message: 'Loading items zip file'
            });
            const itemsZipFile = await JSZip.loadAsync(data.items.file, {});

            logDebug({
                type: 'info',
                message: 'Parsing items zip data'
            });

            result.importData.items.push(
                ...(await data.items.formatService.parseContentItemsAsync({
                    zip: new ZipPackage(itemsZipFile),
                    types: data.types
                }))
            );
        }

        if (data.assets) {
            logDebug({
                type: 'info',
                message: 'Loading assets zip file'
            });
            const assetsZipFile = await JSZip.loadAsync(data.assets.file, {});

            logDebug({
                type: 'info',
                message: 'Parsing assets zip data'
            });

            result.importData.assets.push(
                ...(await data.assets.formatService.parseAssetsAsync({
                    zip: new ZipPackage(assetsZipFile)
                }))
            );
        }

        logDebug({
            type: 'info',
            message: `Parsing completed. Parsed '${colors.yellow(
                result.importData.items.length.toString()
            )}' items and '${colors.yellow(result.importData.assets.length.toString())}' assets`
        });

        return result;
    }

    async parseFileAsync(data: {
        items?: {
            file: Buffer;
            formatService: IItemFormatService;
        };
        assets?: {
            file: Buffer;
            formatService: IAssetFormatService;
        };
        types: IImportContentType[];
    }): Promise<IImportSource> {
        let parsedItems: IParsedContentItem[] = [];
        let parsedAssets: IParsedAsset[] = [];

        if (data.items) {
            logDebug({
                type: 'info',
                message: `Parsing items file with '${colors.yellow(data.items.formatService.name)}' `
            });

            const itemsZipFile = await JSZip.loadAsync(data.items.file, {});
            parsedItems = await data.items.formatService.parseContentItemsAsync({
                zip: new ZipPackage(itemsZipFile),
                types: data.types
            });
        }

        if (data.assets) {
            logDebug({
                type: 'info',
                message: `Parsing assets file with '${colors.yellow(data.assets.formatService.name)}' `
            });

            const assetsZipFile = await JSZip.loadAsync(data.assets.file, {});
            parsedAssets = await data.assets.formatService.parseAssetsAsync({
                zip: new ZipPackage(assetsZipFile)
            });
        }

        const result: IImportSource = {
            importData: {
                items: parsedItems,
                assets: parsedAssets
            }
        };

        logDebug({
            type: 'info',
            message: `Parsing completed. Parsed '${colors.yellow(
                result.importData.items.length.toString()
            )}' items and '${colors.yellow(result.importData.assets.length.toString())}' assets`
        });

        return result;
    }

    async createItemsZipAsync(
        exportData: IExportAdapterResult,
        config: {
            transformConfig: IExportTransformConfig;
            itemFormatService: IItemFormatService;
            compressionLevel?: ZipCompressionLevel;
        }
    ): Promise<FileBinaryData> {
        logDebug({
            type: 'info',
            message: `Creating items zip`,
            partA: config.itemFormatService.name
        });

        const zip = await config.itemFormatService.transformContentItemsAsync({
            items: exportData.items,
            zip: new ZipPackage(new JSZip())
        });

        return zip;
    }

    async createAssetsZipAsync(
        exportData: IExportAdapterResult,
        config: {
            assetFormatService: IAssetFormatService;
            compressionLevel?: ZipCompressionLevel;
        }
    ): Promise<FileBinaryData> {
        logDebug({
            type: 'info',
            message: `Creating assets zip`,
            partA: config.assetFormatService?.name
        });

        const zip = await config.assetFormatService.transformAssetsAsync({
            assets: exportData.assets,
            zip: new ZipPackage(new JSZip())
        });

        return zip;
    }
}
