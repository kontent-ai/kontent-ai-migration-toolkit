import { confirmImportAsync, defaultZipFilename, getDefaultLogger } from '../../../core/index.js';
import { extractAsync, importAsync } from '../../../toolkit/index.js';
import { CliArgumentsFetcher } from '../cli.models.js';

export async function importActionAsync(argsFetcher: CliArgumentsFetcher): Promise<void> {
    const log = getDefaultLogger();
    const environmentId = argsFetcher.getRequiredArgumentValue('targetEnvironmentId');
    const apiKey = argsFetcher.getRequiredArgumentValue('targetApiKey');
    const baseUrl = argsFetcher.getOptionalArgumentValue('baseUrl');
    const createReportFile = argsFetcher.getBooleanArgumentValue('createReportFile', false);
    const force = argsFetcher.getBooleanArgumentValue('force', false);
    const filename = argsFetcher.getOptionalArgumentValue('filename') ?? defaultZipFilename;

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
        baseUrl: baseUrl,
        environmentId: environmentId,
        apiKey: apiKey,
        createReportFile: createReportFile
    });

    log.log({ type: 'completed', message: `Import has been successful` });
}
