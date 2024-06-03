import { libMetadata } from '../metadata.js';
import { Log, executeWithTrackingAsync, getDefaultLogAsync } from '../core/index.js';
import { IKontentAiExportRequestItem, getDefaultExportAdapter } from '../export/index.js';
import { defaultRetryStrategy } from '@kontent-ai-consulting/tools-analytics';
import { getDefaultImportAdapter } from '../import/index.js';

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
    log?: Log;
    sourceEnvironment: IMigrationSource;
    targetEnvironment: IMigrationTarget;
}

export async function migrateAsync(config: IMigrationConfig): Promise<void> {
    const log = config.log ?? await getDefaultLogAsync();

    const exportAdapter = getDefaultExportAdapter({
        environmentId: config.sourceEnvironment.id,
        apiKey: config.sourceEnvironment.apiKey,
        exportItems: config.sourceEnvironment.items,
        log: log,
        retryStrategy: defaultRetryStrategy
    });

    const importAdapter = getDefaultImportAdapter({
        log: log,
        environmentId: config.targetEnvironment.id,
        apiKey: config.targetEnvironment.apiKey,
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
            details: {
                itemsCount: config.sourceEnvironment.items.length
            }
        },
        func: async () => {
            const exportData = await exportAdapter.exportAsync();
            await importAdapter.importAsync(exportData);
        }
    });
}
