import chalk from 'chalk';
import { writeFile } from 'fs/promises';
import { executeWithTrackingAsync } from '../core/index.js';
import { ImportConfig, ImportResult, importManager as _importManager } from '../import/index.js';
import { libMetadata } from '../metadata.js';

export async function importAsync(config: ImportConfig): Promise<ImportResult> {
    return await executeWithTrackingAsync({
        event: {
            tool: 'migrationToolkit',
            package: {
                name: libMetadata.name,
                version: libMetadata.version
            },
            action: 'import',
            relatedEnvironmentId: undefined,
            details: {}
        },
        func: async () => {
            const importManager = _importManager(config);
            const importResult = await importManager.importAsync();

            if (config.createReportFile) {
                const reportFile = importManager.getReportFile(importResult);
                await writeFile(reportFile.filename, reportFile.content);
                config.logger?.log({
                    type: 'writeFs',
                    message: `Report '${chalk.yellow(reportFile.filename)}' was created`
                });
            }

            return importResult;
        },
        logger: config.logger
    });
}
