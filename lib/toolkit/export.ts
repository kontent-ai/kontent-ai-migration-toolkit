import { libMetadata } from '../metadata.js';
import { executeWithTrackingAsync } from '../core/index.js';
import { ExportResult, ExportConfig, exportManager } from '../export/index.js';

export async function exportAsync(config: ExportConfig): Promise<ExportResult> {
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
        }
    });
}
