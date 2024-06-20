import chalk from 'chalk';
import JSZip from 'jszip';
import { ExportResult } from '../export/export.models.js';
import { ImportData } from '../import/import.models.js';
import { Logger, MigrationAsset, MigrationItem, getDefaultLogger } from '../core/index.js';
import { ZipPackage } from './zip-package.class.js';
import { ItemFormatService, AssetFormatService, ZipCompressionLevel, ZipContext } from './zip.models.js';

export function zipManager(logger?: Logger, zipContext?: ZipContext) {
    const loggerToUse = logger ?? getDefaultLogger(zipContext);

    const parseZipAsync = async (data: {
        items?: {
            file: Buffer;
            formatService: ItemFormatService;
        };
        assets?: {
            file: Buffer;
            formatService: AssetFormatService;
        };
    }) => {
        const result: ImportData = {
            items: [],
            assets: []
        };

        if (data.items) {
            loggerToUse.log({
                type: 'info',
                message: 'Loading items zip file'
            });
            const itemsZipFile = await JSZip.loadAsync(data.items.file, {});

            loggerToUse.log({
                type: 'info',
                message: 'Parsing items zip data'
            });

            result.items.push(
                ...(await data.items.formatService.parseAsync({
                    zip: new ZipPackage(itemsZipFile, loggerToUse, zipContext)
                }))
            );
        }

        if (data.assets) {
            loggerToUse.log({
                type: 'info',
                message: 'Loading assets zip file'
            });
            const assetsZipFile = await JSZip.loadAsync(data.assets.file, {});

            loggerToUse.log({
                type: 'info',
                message: 'Parsing assets zip data'
            });

            result.assets.push(
                ...(await data.assets.formatService.parseAsync({
                    zip: new ZipPackage(assetsZipFile, loggerToUse, zipContext)
                }))
            );
        }

        loggerToUse.log({
            type: 'info',
            message: `Parsing completed. Parsed '${chalk.yellow(
                result.items.length.toString()
            )}' items and '${chalk.yellow(result.assets.length.toString())}' assets`
        });

        return result;
    };

    const parseFileAsync = async (data: {
        items?: {
            file: Buffer;
            formatService: ItemFormatService;
        };
        assets?: {
            file: Buffer;
            formatService: AssetFormatService;
        };
    }) => {
        let parsedItems: MigrationItem[] = [];
        let parsedAssets: MigrationAsset[] = [];

        if (data.items) {
            loggerToUse.log({
                type: 'info',
                message: `Parsing items file with '${chalk.yellow(data.items.formatService.name)}' `
            });

            const itemsZipFile = await JSZip.loadAsync(data.items.file, {});
            parsedItems = await data.items.formatService.parseAsync({
                zip: new ZipPackage(itemsZipFile, loggerToUse, zipContext)
            });
        }

        if (data.assets) {
            loggerToUse.log({
                type: 'info',
                message: `Parsing assets file with '${chalk.yellow(data.assets.formatService.name)}' `
            });

            const assetsZipFile = await JSZip.loadAsync(data.assets.file, {});
            parsedAssets = await data.assets.formatService.parseAsync({
                zip: new ZipPackage(assetsZipFile, loggerToUse, zipContext)
            });
        }

        const result: ImportData = {
            items: parsedItems,
            assets: parsedAssets
        };

        loggerToUse.log({
            type: 'info',
            message: `Parsing completed. Parsed '${chalk.yellow(
                result.items.length.toString()
            )}' items and '${chalk.yellow(result.assets.length.toString())}' assets`
        });

        return result;
    };

    const createItemsZipAsync = async (
        exportData: ExportResult,
        config: {
            itemFormatService: ItemFormatService;
            compressionLevel?: ZipCompressionLevel;
        }
    ) => {
        loggerToUse.log({
            type: 'info',
            message: `Creating items zip`
        });

        const zip = await config.itemFormatService.transformAsync({
            items: exportData.items,
            zip: new ZipPackage(new JSZip(), loggerToUse, zipContext)
        });

        return zip;
    };

    const createAssetsZipAsync = async (
        exportData: ExportResult,
        config: {
            assetFormatService: AssetFormatService;
            compressionLevel?: ZipCompressionLevel;
        }
    ) => {
        loggerToUse.log({
            type: 'info',
            message: `Creating assets zip`
        });

        const zip = await config.assetFormatService.transformAsync({
            assets: exportData.assets,
            zip: new ZipPackage(new JSZip(), loggerToUse, zipContext)
        });

        return zip;
    };

    return {
        createAssetsZipAsync,
        createItemsZipAsync,
        parseFileAsync,
        parseZipAsync
    };
}
