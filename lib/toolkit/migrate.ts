import { libMetadata } from '../metadata.js';
import { IRetryStrategyOptions } from '@kontent-ai/core-sdk';
import {
    ExternalIdGenerator,
    Logger,
    MigrationData,
    executeWithTrackingAsync,
    getDefaultLogger
} from '../core/index.js';
import { SourceExportItem } from '../export/index.js';
import { exportAsync } from './export.js';
import { importAsync } from './import.js';
import { ImportResult } from '../import/index.js';

export interface MigrationEnv {
    readonly id: string;
    readonly apiKey: string;
}

export interface MigrationSource extends MigrationEnv {
    readonly items: readonly SourceExportItem[];
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

export interface MigrationResult {
    readonly migrationData: MigrationData;
    readonly importResult: ImportResult;
}

export async function migrateAsync(config: MigrationConfig): Promise<MigrationResult> {
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
            const migrationData = await exportAsync({
                logger: logger,
                environmentId: config.sourceEnvironment.id,
                apiKey: config.sourceEnvironment.apiKey,
                exportItems: config.sourceEnvironment.items,
                retryStrategy: config.retryStrategy
            });

            const importResult = await importAsync({
                logger: logger,
                data: migrationData,
                environmentId: config.targetEnvironment.id,
                apiKey: config.targetEnvironment.apiKey,
                skipFailedItems: config.targetEnvironment.skipFailedItems ?? false,
                retryStrategy: config.retryStrategy,
                externalIdGenerator: config.externalIdGenerator
            });

            return {
                importResult,
                migrationData
            };
        }
    });
}
