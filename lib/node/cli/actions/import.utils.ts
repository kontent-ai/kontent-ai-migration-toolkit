import colors from 'colors';
import { getExtension, logErrorAndExit, confirmImportAsync, withDefaultLogAsync } from '../../../core/index.js';
import { IImportToolkitConfig, ImportToolkit } from '../../../toolkit/index.js';
import { ICliFileConfig } from '../cli.models.js';
import { getAssetFormatService, getItemFormatService } from '../utils/cli.utils.js';
import { ImportSourceType } from '../../../import/index.js';

export async function importAsync(config: ICliFileConfig): Promise<void> {
    const managementApiKey = config.managementApiKey;
    const environmentId = config.environmentId;

    if (!managementApiKey) {
        logErrorAndExit({
            message: `Missing 'managementApiKey' configuration option`
        });
    }
    if (!environmentId) {
        logErrorAndExit({
            message: `Missing 'environmentId' configuration option`
        });
    }

    await confirmImportAsync({
        force: config.force,
        apiKey: managementApiKey,
        environmentId: environmentId
    });

    await withDefaultLogAsync(async (log) => {
        const itemsFilename: string | undefined = config.itemsFilename;
        const assetsFilename: string | undefined = config.assetsFilename;

        const itemsFileExtension = getExtension(itemsFilename ?? '')?.toLowerCase();

        let sourceType: ImportSourceType;

        if (itemsFileExtension?.endsWith('zip'.toLowerCase())) {
            sourceType = 'zip';
        } else if (itemsFileExtension?.endsWith('csv'.toLowerCase())) {
            sourceType = 'file';
        } else if (itemsFileExtension?.endsWith('json'.toLowerCase())) {
            sourceType = 'file';
        } else {
            logErrorAndExit({
                message: `Unsupported file type '${colors.red(itemsFileExtension?.toString() ?? '')}'`
            });
        }

        const importToolkitConfig: IImportToolkitConfig = {
            log: log,
            sourceType: sourceType,
            skipFailedItems: config.skipFailedItems,
            baseUrl: config.baseUrl,
            environmentId: environmentId,
            managementApiKey: managementApiKey,
            canImport: {
                contentItem: (item) => {
                    return true;
                },
                asset: (asset) => {
                    return true;
                }
            }
        };

        const importToolkit = new ImportToolkit(importToolkitConfig);

        await importToolkit.importFromFilesAsync({
            items: itemsFilename
                ? {
                      filename: itemsFilename,
                      formatService: getItemFormatService(config.format)
                  }
                : undefined,
            assets: assetsFilename
                ? {
                      filename: assetsFilename,
                      formatService: getAssetFormatService(config.format)
                  }
                : undefined
        });

        log.console({ type: 'completed', message: `Import has been successful` });
    });
}
