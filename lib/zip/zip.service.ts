import chalk from 'chalk';
import JSZip from 'jszip';

import { IExportAdapterResult } from '../export/index.js';
import { IItemFormatService, ZipCompressionLevel, IAssetFormatService, FileBinaryData } from './zip.models.js';
import { ZipPackage } from './zip-package.class.js';
import { IFlattenedContentType, IMigrationAsset, IMigrationItem, Log } from '../core/index.js';
import { IImportData } from '../import/import.models.js';

export function getZipService(log: Log): ZipService {
    return new ZipService(log);
}

export class ZipService {
    constructor(private readonly log: Log) {}

    async parseZipAsync(data: {
        items?: {
            file: Buffer;
            formatService: IItemFormatService;
        };
        assets?: {
            file: Buffer;
            formatService: IAssetFormatService;
        };
        types: IFlattenedContentType[];
    }): Promise<IImportData> {
        const result: IImportData = {
            items: [],
            assets: []
        };

        if (data.items) {
            this.log.logger({
                type: 'info',
                message: 'Loading items zip file'
            });
            const itemsZipFile = await JSZip.loadAsync(data.items.file, {});

            this.log.logger({
                type: 'info',
                message: 'Parsing items zip data'
            });

            result.items.push(
                ...(await data.items.formatService.parseContentItemsAsync({
                    zip: new ZipPackage(itemsZipFile, this.log),
                    types: data.types
                }))
            );
        }

        if (data.assets) {
            this.log.logger({
                type: 'info',
                message: 'Loading assets zip file'
            });
            const assetsZipFile = await JSZip.loadAsync(data.assets.file, {});

            this.log.logger({
                type: 'info',
                message: 'Parsing assets zip data'
            });

            result.assets.push(
                ...(await data.assets.formatService.parseAssetsAsync({
                    zip: new ZipPackage(assetsZipFile, this.log)
                }))
            );
        }

        this.log.logger({
            type: 'info',
            message: `Parsing completed. Parsed '${chalk.yellow(
                result.items.length.toString()
            )}' items and '${chalk.yellow(result.assets.length.toString())}' assets`
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
        types: IFlattenedContentType[];
    }): Promise<IImportData> {
        let parsedItems: IMigrationItem[] = [];
        let parsedAssets: IMigrationAsset[] = [];

        if (data.items) {
            this.log.logger({
                type: 'info',
                message: `Parsing items file with '${chalk.yellow(data.items.formatService.name)}' `
            });

            const itemsZipFile = await JSZip.loadAsync(data.items.file, {});
            parsedItems = await data.items.formatService.parseContentItemsAsync({
                zip: new ZipPackage(itemsZipFile, this.log),
                types: data.types
            });
        }

        if (data.assets) {
            this.log.logger({
                type: 'info',
                message: `Parsing assets file with '${chalk.yellow(data.assets.formatService.name)}' `
            });

            const assetsZipFile = await JSZip.loadAsync(data.assets.file, {});
            parsedAssets = await data.assets.formatService.parseAssetsAsync({
                zip: new ZipPackage(assetsZipFile, this.log)
            });
        }

        const result: IImportData = {
            items: parsedItems,
            assets: parsedAssets
        };

        this.log.logger({
            type: 'info',
            message: `Parsing completed. Parsed '${chalk.yellow(
                result.items.length.toString()
            )}' items and '${chalk.yellow(result.assets.length.toString())}' assets`
        });

        return result;
    }

    async createItemsZipAsync(
        exportData: IExportAdapterResult,
        config: {
            itemFormatService: IItemFormatService;
            compressionLevel?: ZipCompressionLevel;
        }
    ): Promise<FileBinaryData> {
        this.log.logger({
            type: 'info',
            message: `Creating items zip`,
            count: {
                index: 1,
                total: 1
            }
        });

        const zip = await config.itemFormatService.transformContentItemsAsync({
            items: exportData.items,
            zip: new ZipPackage(new JSZip(), this.log)
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
        this.log.logger({
            type: 'info',
            message: `Creating assets zip`,
            count: {
                index: 1,
                total: 1
            }
        });

        const zip = await config.assetFormatService.transformAssetsAsync({
            assets: exportData.assets,
            zip: new ZipPackage(new JSZip(), this.log)
        });

        return zip;
    }
}
