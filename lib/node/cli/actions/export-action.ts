import { confirmExportAsync, getDefaultLog } from '../../../core/index.js';
import { exportAsync } from '../../../toolkit/index.js';
import { getDefaultExportAdapter } from '../../../export/index.js';
import { getDefaultExportFilename } from '../utils/cli.utils.js';
import { AssetJsonProcessorService, ItemJsonProcessorService } from '../../../file/index.js';
import { CliArgs } from '../args/cli-args.class.js';

export async function exportActionAsync(cliArgs: CliArgs): Promise<void> {
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

    await exportAsync({
        log: log,
        adapter: getDefaultExportAdapter({
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
        }),
        items: {
            filename: itemsFilename,
            formatService: new ItemJsonProcessorService()
        },
        assets: {
            filename: assetsFilename,
            formatService: new AssetJsonProcessorService()
        }
    });

    log.console({ type: 'completed', message: `Export has been successful` });
}
