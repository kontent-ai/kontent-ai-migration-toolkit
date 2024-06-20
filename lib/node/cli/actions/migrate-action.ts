import { migrateAsync } from '../../../toolkit/index.js';
import { confirmMigrateAsync, getDefaultLogger } from '../../../core/index.js';
import { SourceExportItem } from '../../../export/index.js';
import { CliArgumentsFetcher } from '../cli.models.js';

export async function migrateActionAsync(argsFetcher: CliArgumentsFetcher): Promise<void> {
    const log = getDefaultLogger();
    const sourceEnvironmentId = argsFetcher.getRequiredArgumentValue('sourceEnvironmentId');
    const sourceApiKey = argsFetcher.getRequiredArgumentValue('sourceApiKey');
    const targetEnvironmentId = argsFetcher.getRequiredArgumentValue('targetEnvironmentId');
    const targetApiKey = argsFetcher.getRequiredArgumentValue('targetApiKey');
    const force = argsFetcher.getBooleanArgumentValue('force', false);
    const skipFailedItems = argsFetcher.getBooleanArgumentValue('skipFailedItems', false);
    const items = argsFetcher.getRequiredArgumentValue('items')?.split(',');
    const language = argsFetcher.getRequiredArgumentValue('language');
    const migrateItems: SourceExportItem[] = items.map((m) => {
        return {
            itemCodename: m,
            languageCodename: language
        };
    });

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
        logger: log,
        dataToMigrate: {
            itemsCount: migrateItems.length
        }
    });

    await migrateAsync({
        logger: log,
        sourceEnvironment: {
            id: sourceEnvironmentId,
            apiKey: sourceApiKey,
            items: migrateItems
        },
        targetEnvironment: {
            id: targetEnvironmentId,
            apiKey: targetApiKey,
            skipFailedItems: skipFailedItems
        }
    });

    log.log({ type: 'completed', message: `Migration has been successful` });
}
