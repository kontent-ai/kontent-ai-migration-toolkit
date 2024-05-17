import { getDefaultLog, logErrorAndExit } from '../../../core/index.js';
import { ExportToolkit } from '../../../toolkit/index.js';
import { KontentAiExportAdapter } from '../../../export/index.js';
import { ICliFileConfig } from '../cli.models.js';
import { getDefaultExportFilename } from '../utils/cli.utils.js';
import { AssetJsonProcessorService, ItemJsonProcessorService } from '../../../file/index.js';

export async function exportAsync(config: ICliFileConfig): Promise<void> {
    const log = getDefaultLog();
    const language = config.language;

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

    const adapter = new KontentAiExportAdapter({
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

    const itemsFilename = config.itemsFilename ?? getDefaultExportFilename('items');
    const assetsFilename = config.assetsFilename ?? getDefaultExportFilename('assets');

    const exportToolkit = new ExportToolkit({
        log: log,
        adapter,
        items: {
            filename: itemsFilename,
            formatService: new ItemJsonProcessorService()
        },
        assets: assetsFilename
            ? {
                  filename: assetsFilename,
                  formatService: new AssetJsonProcessorService()
              }
            : undefined
    });

    await exportToolkit.exportAsync();

    log.console({ type: 'completed', message: `Export has been successful` });
}
