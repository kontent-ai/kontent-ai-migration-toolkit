import { libMetadata } from '../metadata.js';
import { IRetryStrategyOptions } from '@kontent-ai/core-sdk';
import { Log, executeWithTrackingAsync, getDefaultLogAsync } from '../core/index.js';
import { IKontentAiExportRequestItem, getDefaultExportAdapter } from '../export/index.js';
import { getDefaultImportAdapter } from '../import/index.js';

export interface IMigrationEnv {
    id: string;
    apiKey: string;
}

export interface IMigrationSource extends IMigrationEnv {
    items: IKontentAiExportRequestItem[];
    skipFailedItems?: boolean;
}

export interface IMigrationTarget extends IMigrationEnv {
    skipFailedItems?: boolean;
}

export interface IMigrationConfig {
    retryStrategy?: IRetryStrategyOptions;
    log?: Log;
    sourceEnvironment: IMigrationSource;
    targetEnvironment: IMigrationTarget;
}

export async function migrateAsync(config: IMigrationConfig): Promise<void> {
    const log = config.log ?? (await getDefaultLogAsync());

    const exportAdapter = getDefaultExportAdapter({
        environmentId: config.sourceEnvironment.id,
        apiKey: config.sourceEnvironment.apiKey,
        exportItems: config.sourceEnvironment.items,
        log: log,
        retryStrategy: config.retryStrategy,
        skipFailedItems: config.sourceEnvironment.skipFailedItems ?? false
    });

    const importAdapter = getDefaultImportAdapter({
        log: log,
        environmentId: config.targetEnvironment.id,
        apiKey: config.targetEnvironment.apiKey,
        skipFailedItems: config.targetEnvironment.skipFailedItems ?? false,
        retryStrategy: config.retryStrategy
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
