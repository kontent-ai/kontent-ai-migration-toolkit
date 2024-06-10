import { libMetadata } from '../metadata.js';
import { IRetryStrategyOptions } from '@kontent-ai/core-sdk';
import { IExternalIdGenerator, ILogger, executeWithTrackingAsync, getDefaultLogger } from '../core/index.js';
import { IKontentAiExportRequestItem } from '../export/index.js';
import { exportAsync } from './export.js';
import { importAsync } from './import.js';

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
    externalIdGenerator?: IExternalIdGenerator;
    logger?: ILogger;
    sourceEnvironment: IMigrationSource;
    targetEnvironment: IMigrationTarget;
}

export async function migrateAsync(config: IMigrationConfig): Promise<void> {
    const logger = config.logger ?? getDefaultLogger();

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
            const data = await exportAsync({
                logger: logger,
                adapterConfig: {
                    environmentId: config.sourceEnvironment.id,
                    apiKey: config.sourceEnvironment.apiKey,
                    exportItems: config.sourceEnvironment.items,
                    retryStrategy: config.retryStrategy,
                    skipFailedItems: config.sourceEnvironment.skipFailedItems ?? false
                }
            });

            await importAsync({
                logger: logger,
                data: data,
                adapterConfig: {
                    environmentId: config.targetEnvironment.id,
                    apiKey: config.targetEnvironment.apiKey,
                    skipFailedItems: config.targetEnvironment.skipFailedItems ?? false,
                    retryStrategy: config.retryStrategy,
                    externalIdGenerator: config.externalIdGenerator
                }
            });
        }
    });
}
