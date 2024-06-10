import { migrateAsync } from '../../../toolkit/index.js';
import { confirmMigrateAsync, getDefaultLogger } from '../../../core/index.js';
import { CliArgs } from '../args/cli-args.class.js';

export async function migrateActionAsync(cliArgs: CliArgs): Promise<void> {
    const log = getDefaultLogger();
    const sourceEnvironmentId = await cliArgs.getRequiredArgumentValueAsync('sourceEnvironmentId');
    const sourceApiKey = await cliArgs.getRequiredArgumentValueAsync('sourceApiKey');
    const targetEnvironmentId = await cliArgs.getRequiredArgumentValueAsync('targetEnvironmentId');
    const targetApiKey = await cliArgs.getRequiredArgumentValueAsync('targetApiKey');
    const force = await cliArgs.getBooleanArgumentValueAsync('force', false);
    const skipFailedItems = await cliArgs.getBooleanArgumentValueAsync('skipFailedItems', false);
    const items = (await cliArgs.getRequiredArgumentValueAsync('items'))?.split(',');
    const language = await cliArgs.getRequiredArgumentValueAsync('language');

    await confirmMigrateAsync({
        force: force,
        sourceEnvironment: {
            apiKey: sourceApiKey,
            environmentId: sourceEnvironmentId
        },
        targetEnvironment: {
            apiKey: targetApiKey,
            environmentId: targetEnvironmentId
        },
        logger: log
    });

    await migrateAsync({
        logger: log,
        sourceEnvironment: {
            id: sourceEnvironmentId,
            apiKey: sourceApiKey,
            items: items.map((m) => {
                return {
                    itemCodename: m,
                    languageCodename: language
                };
            })
        },
        targetEnvironment: {
            id: targetEnvironmentId,
            apiKey: targetApiKey,
            skipFailedItems: skipFailedItems
        }
    });

    log.log({ type: 'completed', message: `Migration has been successful` });
}
