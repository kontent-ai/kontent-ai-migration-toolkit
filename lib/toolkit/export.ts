import { MigrationData, executeWithTrackingAsync } from '../core/index.js';
import { ExportConfig, exportManager } from '../export/index.js';
import { libMetadata } from '../metadata.js';

export async function exportAsync(config: ExportConfig): Promise<MigrationData> {
    return await executeWithTrackingAsync({
        event: {
            tool: 'migrationToolkit',
            package: {
                name: libMetadata.name,
                version: libMetadata.version
            },
            action: 'export',
            relatedEnvironmentId: undefined,
            details: {}
        },
        func: async () => {
            return await exportManager(config).exportAsync();
        },
        logger: config.logger
    });
}
