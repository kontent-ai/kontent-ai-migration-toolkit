import { confirmExportAsync, getDefaultZipFilename, getDefaultLogger } from '../../../core/index.js';
import { exportAsync, storeAsync } from '../../../toolkit/index.js';
import { CliArgs } from '../args/cli-args.class.js';

export async function exportActionAsync(cliArgs: CliArgs): Promise<void> {
    const logger = getDefaultLogger();
    const language = await cliArgs.getRequiredArgumentValueAsync('language');
    const environmentId = await cliArgs.getRequiredArgumentValueAsync('sourceEnvironmentId');
    const apiKey = await cliArgs.getRequiredArgumentValueAsync('sourceApiKey');
    const items = (await cliArgs.getRequiredArgumentValueAsync('items')).split(',');
    const baseUrl = await cliArgs.getOptionalArgumentValueAsync('baseUrl');
    const force = await cliArgs.getBooleanArgumentValueAsync('force', false);
    const skipFailedItems = await cliArgs.getBooleanArgumentValueAsync('skipFailedItems', false);
    const filename = (await cliArgs.getOptionalArgumentValueAsync('filename')) ?? getDefaultZipFilename();

    await confirmExportAsync({
        force: force,
        apiKey: apiKey,
        environmentId: environmentId,
        logger: logger,
        dataToExport: {
            itemsCount: items.length
        }
    });

    const exportedData = await exportAsync({
        logger: logger,
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
    });

    await storeAsync({
        data: exportedData,
        filename: filename,
        logger: logger
    });

    logger.log({ type: 'completed', message: `Export has been successful` });
}
