import chalk from 'chalk';
import JSZip from 'jszip';

import { ExportAdapterResult } from '../export/index.js';
import {
    ItemFormatService,
    ZipCompressionLevel,
    AssetFormatService,
    FileBinaryData,
    ZipContext
} from './zip.models.js';
import { ZipPackage } from './zip-package.class.js';
import { MigrationAsset, MigrationItem, Logger } from '../core/index.js';
import { ImportData } from '../import/import.models.js';

export function getZipService(logger: Logger, zipContext?: ZipContext): ZipService {
    return new ZipService(logger, zipContext);
}

export class ZipService {
    constructor(private readonly logger: Logger, private readonly zipContext?: ZipContext) {}

    async parseZipAsync(data: {
        items?: {
            file: Buffer;
            formatService: ItemFormatService;
        };
        assets?: {
            file: Buffer;
            formatService: AssetFormatService;
        };
    }): Promise<ImportData> {
        const result: ImportData = {
            items: [],
            assets: []
        };

        if (data.items) {
            this.logger.log({
                type: 'info',
                message: 'Loading items zip file'
            });
            const itemsZipFile = await JSZip.loadAsync(data.items.file, {});

            this.logger.log({
                type: 'info',
                message: 'Parsing items zip data'
            });

            result.items.push(
                ...(await data.items.formatService.parseAsync({
                    zip: new ZipPackage(itemsZipFile, this.logger, this.zipContext)
                }))
            );
        }

        if (data.assets) {
            this.logger.log({
                type: 'info',
                message: 'Loading assets zip file'
            });
            const assetsZipFile = await JSZip.loadAsync(data.assets.file, {});

            this.logger.log({
                type: 'info',
                message: 'Parsing assets zip data'
            });

            result.assets.push(
                ...(await data.assets.formatService.parseAsync({
                    zip: new ZipPackage(assetsZipFile, this.logger, this.zipContext)
                }))
            );
        }

        this.logger.log({
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
            formatService: ItemFormatService;
        };
        assets?: {
            file: Buffer;
            formatService: AssetFormatService;
        };
    }): Promise<ImportData> {
        let parsedItems: MigrationItem[] = [];
        let parsedAssets: MigrationAsset[] = [];

        if (data.items) {
            this.logger.log({
                type: 'info',
                message: `Parsing items file with '${chalk.yellow(data.items.formatService.name)}' `
            });

            const itemsZipFile = await JSZip.loadAsync(data.items.file, {});
            parsedItems = await data.items.formatService.parseAsync({
                zip: new ZipPackage(itemsZipFile, this.logger, this.zipContext)
            });
        }

        if (data.assets) {
            this.logger.log({
                type: 'info',
                message: `Parsing assets file with '${chalk.yellow(data.assets.formatService.name)}' `
            });

            const assetsZipFile = await JSZip.loadAsync(data.assets.file, {});
            parsedAssets = await data.assets.formatService.parseAsync({
                zip: new ZipPackage(assetsZipFile, this.logger, this.zipContext)
            });
        }

        const result: ImportData = {
            items: parsedItems,
            assets: parsedAssets
        };

        this.logger.log({
            type: 'info',
            message: `Parsing completed. Parsed '${chalk.yellow(
                result.items.length.toString()
            )}' items and '${chalk.yellow(result.assets.length.toString())}' assets`
        });

        return result;
    }

    async createItemsZipAsync(
        exportData: ExportAdapterResult,
        config: {
            itemFormatService: ItemFormatService;
            compressionLevel?: ZipCompressionLevel;
        }
    ): Promise<FileBinaryData> {
        this.logger.log({
            type: 'info',
            message: `Creating items zip`
        });

        const zip = await config.itemFormatService.transformAsync({
            items: exportData.items,
            zip: new ZipPackage(new JSZip(), this.logger, this.zipContext)
        });

        return zip;
    }

    async createAssetsZipAsync(
        exportData: ExportAdapterResult,
        config: {
            assetFormatService: AssetFormatService;
            compressionLevel?: ZipCompressionLevel;
        }
    ): Promise<FileBinaryData> {
        this.logger.log({
            type: 'info',
            message: `Creating assets zip`
        });

        const zip = await config.assetFormatService.transformAsync({
            assets: exportData.assets,
            zip: new ZipPackage(new JSZip(), this.logger, this.zipContext)
        });

        return zip;
    }
}
