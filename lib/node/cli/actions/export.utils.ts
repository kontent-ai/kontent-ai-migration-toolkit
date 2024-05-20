import { confirmExportAsync, getDefaultLog } from '../../../core/index.js';
import { ExportToolkit } from '../../../toolkit/index.js';
import { KontentAiExportAdapter } from '../../../export/index.js';
import { getDefaultExportFilename } from '../utils/cli.utils.js';
import { AssetJsonProcessorService, ItemJsonProcessorService } from '../../../file/index.js';
import { CliArgs } from '../args/cli-args.class.js';

export async function exportAsync(cliArgs: CliArgs): Promise<void> {
    const log = getDefaultLog();
    const language = await cliArgs.getRequiredArgumentValueAsync('language');
    const environmentId = await cliArgs.getRequiredArgumentValueAsync('sourceEnvironmentId');
    const apiKey = await cliArgs.getRequiredArgumentValueAsync('sourceApiKey');
    const items = (await cliArgs.getRequiredArgumentValueAsync('items')).split(',');
    const baseUrl = await cliArgs.getOptionalArgumentValueAsync('baseUrl');
    const force = await cliArgs.getBooleanArgumentValueAsync('force', false);
    const itemsFilename =
        (await cliArgs.getOptionalArgumentValueAsync('itemsFilename')) ?? getDefaultExportFilename('items');
    const assetsFilename =
        (await cliArgs.getOptionalArgumentValueAsync('assetsFilename')) ?? getDefaultExportFilename('assets');

    await confirmExportAsync({
        force: force,
        apiKey: apiKey,
        environmentId: environmentId,
        log: log
    });

    const adapter = new KontentAiExportAdapter({
        log: log,
        environmentId: environmentId,
        apiKey: apiKey,
        baseUrl: baseUrl,
        exportItems: items.map((m) => {
            return {
                itemCodename: m,
                languageCodename: language
            };
        })
    });

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
