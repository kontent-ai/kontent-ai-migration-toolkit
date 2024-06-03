import { confirmImportAsync, getDefaultLogAsync } from '../../../core/index.js';
import { importFromFilesAsync } from '../../../toolkit/index.js';
import { CliArgs } from '../args/cli-args.class.js';
import { getDefaultExportFilename } from '../utils/cli.utils.js';
import { getDefaultImportAdapter } from 'lib/import/index.js';

export async function importActionAsync(cliArgs: CliArgs): Promise<void> {
    const log = await getDefaultLogAsync();

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
            formatService: 'json'
        },
        assets: {
            filename: assetsFilename,
            formatService: 'json'
        },
        log: log,
        adapter: getDefaultImportAdapter({
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
