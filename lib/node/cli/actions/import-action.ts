import { confirmImportAsync, getDefaultLog } from '../../../core/index.js';
import { importFromFilesAsync } from '../../../toolkit/index.js';
import { AssetJsonProcessorService, ItemJsonProcessorService } from '../../../file/index.js';
import { CliArgs } from '../args/cli-args.class.js';
import { getDefaultExportFilename } from '../utils/cli.utils.js';
import { KontentAiImportAdapter } from 'lib/import/index.js';

export async function importActionAsync(cliArgs: CliArgs): Promise<void> {
    const log = getDefaultLog();

    const environmentId = await cliArgs.getRequiredArgumentValueAsync('targetEnvironmentId');
    const apiKey = await cliArgs.getRequiredArgumentValueAsync('targetApiKey');
    const baseUrl = await cliArgs.getOptionalArgumentValueAsync('baseUrl');
    const force = await cliArgs.getBooleanArgumentValueAsync('force', false);
    const skipFailedItems = await cliArgs.getBooleanArgumentValueAsync('skipFailedItems', false);
    const itemsFilename =
        (await cliArgs.getOptionalArgumentValueAsync('itemsFilename')) ?? getDefaultExportFilename('items');
    const assetsFilename =
        (await cliArgs.getOptionalArgumentValueAsync('assetsFilename')) ?? getDefaultExportFilename('assets');

    await confirmImportAsync({
        force: force,
        apiKey: apiKey,
        environmentId: environmentId,
        log: log
    });

    await importFromFilesAsync({
        items: {
            filename: itemsFilename,
            formatService: new ItemJsonProcessorService()
        },
        assets: {
            filename: assetsFilename,
            formatService: new AssetJsonProcessorService()
        },
        log: log,
        adapter: new KontentAiImportAdapter({
            log: log,
            skipFailedItems: skipFailedItems,
            baseUrl: baseUrl,
            environmentId: environmentId,
            apiKey: apiKey,
            canImport: {
                contentItem: (item) => {
                    return true;
                },
                asset: (asset) => {
                    return true;
                }
            }
        })
    });

    log.console({ type: 'completed', message: `Import has been successful` });
}
