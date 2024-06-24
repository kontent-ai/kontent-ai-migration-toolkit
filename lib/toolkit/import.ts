import { executeWithTrackingAsync } from '../core/index.js';
import { ImportConfig, ImportResult, importManager } from '../import/index.js';
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
            return await importManager(config).importAsync();
        }
    });
}
