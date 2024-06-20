import { confirmImportAsync, getDefaultZipFilename, getDefaultLogger } from '../../../core/index.js';
import { extractAsync, importAsync } from '../../../toolkit/index.js';
import { CliArgs } from '../args/cli-args.class.js';

export async function importActionAsync(cliArgs: CliArgs): Promise<void> {
    const log = getDefaultLogger();
    const environmentId = await cliArgs.getRequiredArgumentValueAsync('targetEnvironmentId');
    const apiKey = await cliArgs.getRequiredArgumentValueAsync('targetApiKey');
    const baseUrl = await cliArgs.getOptionalArgumentValueAsync('baseUrl');
    const force = await cliArgs.getBooleanArgumentValueAsync('force', false);
    const skipFailedItems = await cliArgs.getBooleanArgumentValueAsync('skipFailedItems', false);
    const filename = (await cliArgs.getOptionalArgumentValueAsync('filename')) ?? getDefaultZipFilename();

    await confirmImportAsync({
        force: force,
        apiKey: apiKey,
        environmentId: environmentId,
        logger: log
    });

    const importData = await extractAsync({
        logger: log,
        filename: filename
    });

    await importAsync({
        logger: log,
        data: importData,
        skipFailedItems: skipFailedItems,
        baseUrl: baseUrl,
        environmentId: environmentId,
        apiKey: apiKey
    });

    log.log({ type: 'completed', message: `Import has been successful` });
}
