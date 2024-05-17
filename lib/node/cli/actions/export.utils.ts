import colors from 'colors';
import { logErrorAndExit, withDefaultLogAsync } from '../../../core/index.js';
import { ExportToolkit } from '../../../toolkit/index.js';
import { IExportAdapter, KontentAiExportAdapter } from '../../../export/index.js';
import { ICliFileConfig } from '../cli.models.js';
import { getAssetFormatService, getDefaultExportFilename, getItemFormatService } from '../utils/cli.utils.js';

export async function exportAsync(config: ICliFileConfig): Promise<void> {
    await withDefaultLogAsync(async (log) => {
        if (!config.adapter) {
            logErrorAndExit({
                message: `Missing 'adapter' config`
            });
        }

        let adapter: IExportAdapter | undefined;

        if (config.adapter === 'kontentAi') {
            if (!config.environmentId) {
                logErrorAndExit({
                    message: `Invalid 'environmentId' parameter`
                });
            }

            if (!config.managementApiKey) {
                logErrorAndExit({
                    message: `Invalid 'managementApiKey' parameter`
                });
            }

            const language = config.language;

            if (!language) {
                logErrorAndExit({
                    message: `Invalid 'language' parameter`
                });
            }

            if (!config.items) {
                logErrorAndExit({
                    message: `Invalid 'items' parameter`
                });
            }

            adapter = new KontentAiExportAdapter({
                log: log,
                environmentId: config.environmentId,
                managementApiKey: config.managementApiKey,
                baseUrl: config.baseUrl,
                exportItems: config.items.map((m) => {
                    return {
                        itemCodename: m,
                        languageCodename: language
                    };
                })
            });
        } else {
            logErrorAndExit({
                message: `Missing adapter '${colors.red(config.adapter)}'`
            });
        }

        const itemsFilename = config.itemsFilename ?? getDefaultExportFilename('items');
        const assetsFilename = config.assetsFilename ?? getDefaultExportFilename('assets');

        const exportToolkit = new ExportToolkit({
            log: log,
            adapter,
            items: {
                filename: itemsFilename,
                formatService: getItemFormatService(config.format)
            },
            assets: assetsFilename
                ? {
                      filename: assetsFilename,
                      formatService: getAssetFormatService(config.format)
                  }
                : undefined
        });

        await exportToolkit.exportAsync();

        log.console({ type: 'completed', message: `Export has been successful` });
    });
}
