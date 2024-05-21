import { libMetadata } from '../metadata.js';
import { Log, executeWithTrackingAsync } from '../core/index.js';
import { IKontentAiExportRequestItem, KontentAiExportAdapter } from '../export/index.js';
import { getImportService } from 'lib/import/import.service.js';
import { defaultRetryStrategy } from '@kontent-ai-consulting/tools-analytics';

export interface IMigrationEnv {
    id: string;
    apiKey: string;
}

export interface IMigrationSource extends IMigrationEnv {
    items: IKontentAiExportRequestItem[];
}

export interface IMigrationTarget extends IMigrationEnv {
    skipFailedItems?: boolean;
}

export interface IMigrationConfig {
    log: Log;
    sourceEnvironment: IMigrationSource;
    targetEnvironment: IMigrationTarget;
}

export async function migrateAsync(config: IMigrationConfig): Promise<void> {
    const exportAdapter = new KontentAiExportAdapter({
        environmentId: config.sourceEnvironment.id,
        apiKey: config.sourceEnvironment.apiKey,
        exportItems: config.sourceEnvironment.items,
        log: config.log,
        retryStrategy: defaultRetryStrategy
    });
    const importService = getImportService({
        log: config.log,
        environmentId: config.targetEnvironment.id,
        managementApiKey: config.targetEnvironment.apiKey,
        skipFailedItems: config.targetEnvironment.skipFailedItems ?? false,
        retryStrategy: defaultRetryStrategy
    });

    return await executeWithTrackingAsync({
        event: {
            tool: 'migrationToolkit',
            package: {
                name: libMetadata.name,
                version: libMetadata.version
            },
            action: 'migrate',
            relatedEnvironmentId: undefined,
            details: {}
        },
        func: async () => {
            const exportData = await exportAdapter.exportAsync();
            await importService.importAsync(exportData);
        }
    });
}
