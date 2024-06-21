import { confirmExportAsync, getDefaultZipFilename, getDefaultLogger } from '../../../core/index.js';
import { exportAsync, storeAsync } from '../../../toolkit/index.js';
import { CliArgumentsFetcher } from '../cli.models.js';

export async function exportActionAsync(cliFetcher: CliArgumentsFetcher): Promise<void> {
    const logger = getDefaultLogger();
    const language = cliFetcher.getRequiredArgumentValue('language');
    const environmentId = cliFetcher.getRequiredArgumentValue('sourceEnvironmentId');
    const apiKey = cliFetcher.getRequiredArgumentValue('sourceApiKey');
    const items = cliFetcher.getRequiredArgumentValue('items').split(',');
    const baseUrl = cliFetcher.getOptionalArgumentValue('baseUrl');
    const force = cliFetcher.getBooleanArgumentValue('force', false);
    const filename = cliFetcher.getOptionalArgumentValue('filename') ?? getDefaultZipFilename();

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
