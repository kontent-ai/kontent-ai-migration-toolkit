import { confirmExportAsync, getDefaultFilename, getDefaultLogAsync } from '../../../core/index.js';
import { exportAsync, storeAsync } from '../../../toolkit/index.js';
import { CliArgs } from '../args/cli-args.class.js';

export async function exportActionAsync(cliArgs: CliArgs): Promise<void> {
    const log = await getDefaultLogAsync();
    const language = await cliArgs.getRequiredArgumentValueAsync('language');
    const environmentId = await cliArgs.getRequiredArgumentValueAsync('sourceEnvironmentId');
    const apiKey = await cliArgs.getRequiredArgumentValueAsync('sourceApiKey');
    const items = (await cliArgs.getRequiredArgumentValueAsync('items')).split(',');
    const baseUrl = await cliArgs.getOptionalArgumentValueAsync('baseUrl');
    const force = await cliArgs.getBooleanArgumentValueAsync('force', false);
    const skipFailedItems = await cliArgs.getBooleanArgumentValueAsync('skipFailedItems', false);
    const itemsFilename = (await cliArgs.getOptionalArgumentValueAsync('itemsFilename')) ?? getDefaultFilename('items');
    const assetsFilename =
        (await cliArgs.getOptionalArgumentValueAsync('assetsFilename')) ?? getDefaultFilename('assets');

    await confirmExportAsync({
        force: force,
        apiKey: apiKey,
        environmentId: environmentId,
        log: log
    });

    const exportedData = await exportAsync({
        log: log,
        adapterConfig: {
            environmentId: environmentId,
            apiKey: apiKey,
            baseUrl: baseUrl,
            skipFailedItems: skipFailedItems,
            exportItems: items.map((m) => {
                return {
                    itemCodename: m,
                    languageCodename: language
                };
            })
        }
    });

    await storeAsync({
        data: exportedData,
        files: {
            items: {
                filename: itemsFilename,
                formatService: 'json'
            },
            assets: {
                filename: assetsFilename,
                formatService: 'json'
            }
        },
        log: log,
        zipContext: 'node.js'
    });

    log.default({ type: 'completed', message: `Export has been successful` });
}
