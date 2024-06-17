import { libMetadata } from '../metadata.js';
import { IRetryStrategyOptions } from '@kontent-ai/core-sdk';
import { ExternalIdGenerator, Logger, executeWithTrackingAsync, getDefaultLogger } from '../core/index.js';
import { SourceExportItem } from '../export/index.js';
import { exportAsync } from './export.js';
import { importAsync } from './import.js';

export interface MigrationEnv {
    readonly id: string;
    readonly apiKey: string;
}

export interface MigrationSource extends MigrationEnv {
    readonly items: SourceExportItem[];
    readonly skipFailedItems?: boolean;
}

export interface MigrationTarget extends MigrationEnv {
    readonly skipFailedItems?: boolean;
}

export interface MigrationConfig {
    readonly retryStrategy?: IRetryStrategyOptions;
    readonly externalIdGenerator?: ExternalIdGenerator;
    readonly logger?: Logger;
    readonly sourceEnvironment: MigrationSource;
    readonly targetEnvironment: MigrationTarget;
}

export async function migrateAsync(config: MigrationConfig): Promise<void> {
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
