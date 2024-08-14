import { libMetadata } from '../metadata.js';
import { IRetryStrategyOptions } from '@kontent-ai/core-sdk';
import {
    ExternalIdGenerator,
    Logger,
    ManagementClientConfig,
    MigrationData,
    executeWithTrackingAsync,
    getDefaultLogger
} from '../core/index.js';
import { SourceExportItem } from '../export/index.js';
import { exportAsync } from './export.js';
import { importAsync } from './import.js';
import { ImportResult } from '../import/index.js';

export interface MigrationSource extends ManagementClientConfig {
    readonly items: readonly SourceExportItem[];
}

export interface MigrationConfig {
    readonly retryStrategy?: IRetryStrategyOptions;
    readonly externalIdGenerator?: ExternalIdGenerator;
    readonly logger?: Logger;
    readonly sourceEnvironment: MigrationSource;
    readonly targetEnvironment: ManagementClientConfig;
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
                ...config.sourceEnvironment,
                logger: logger,
                exportItems: config.sourceEnvironment.items
            });

            const importResult = await importAsync({
                ...config.targetEnvironment,
                logger: logger,
                data: migrationData,
                externalIdGenerator: config.externalIdGenerator
            });

            return {
                importResult,
                migrationData
            };
        }
    });
}
