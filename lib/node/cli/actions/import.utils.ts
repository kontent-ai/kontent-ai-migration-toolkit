import colors from 'colors';
import { getExtension, logErrorAndExit, confirmActionAsync, getDefaultLog } from '../../../core/index.js';
import { IImportToolkitConfig, ImportToolkit } from '../../../toolkit/index.js';
import { ICliFileConfig } from '../cli.models.js';
import { ImportSourceType } from '../../../import/index.js';
import { AssetJsonProcessorService, ItemJsonProcessorService } from '../../../file/index.js';

export async function importAsync(config: ICliFileConfig): Promise<void> {
    const log = getDefaultLog();
    const apiKey = config.apiKey;
    const environmentId = config.environmentId;

    if (!apiKey) {
        logErrorAndExit({
            message: `Missing 'apiKey' configuration option`
        });
    }
    if (!environmentId) {
        logErrorAndExit({
            message: `Missing 'environmentId' configuration option`
        });
    }

    await confirmActionAsync({
        action: 'import',
        force: config.force,
        apiKey: apiKey,
        environmentId: environmentId,
        log: log
    });

    const itemsFilename: string | undefined = config.itemsFilename;
    const assetsFilename: string | undefined = config.assetsFilename;

    const itemsFileExtension = getExtension(itemsFilename ?? '')?.toLowerCase();

    let sourceType: ImportSourceType;

    if (itemsFileExtension?.endsWith('zip'.toLowerCase())) {
        sourceType = 'zip';
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
        managementApiKey: apiKey,
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
                  formatService: new ItemJsonProcessorService()
              }
            : undefined,
        assets: assetsFilename
            ? {
                  filename: assetsFilename,
                  formatService: new AssetJsonProcessorService()
              }
            : undefined
    });

    log.console({ type: 'completed', message: `Import has been successful` });
}
