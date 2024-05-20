import { libMetadata } from '../metadata.js';
import { Log, executeWithTrackingAsync } from '../core/index.js';
import { IExportAdapter, IKontentAiExportRequestItem, KontentAiExportAdapter } from '../export/index.js';
import { ImportService, getImportService } from 'lib/import/import.service.js';
import { defaultRetryStrategy } from '@kontent-ai-consulting/tools-analytics';

export interface IMigrationToolkitEnv {
    id: string;
    apiKey: string;
}

export interface IMigrationToolkitSource extends IMigrationToolkitEnv {
    items: IKontentAiExportRequestItem[];
}

export interface IMigrationToolkitTarget extends IMigrationToolkitEnv {
    skipFailedItems?: boolean;
}

export interface IMigrationToolkitConfig {
    log: Log;
    sourceEnvironment: IMigrationToolkitSource;
    targetEnvironment: IMigrationToolkitTarget;
}

export class MigrationToolkit {
    private readonly exportAdapter: IExportAdapter;
    private readonly importService: ImportService;

    constructor(readonly config: IMigrationToolkitConfig) {
        this.exportAdapter = new KontentAiExportAdapter({
            environmentId: config.sourceEnvironment.id,
            apiKey: config.sourceEnvironment.apiKey,
            exportItems: config.sourceEnvironment.items,
            log: config.log,
            retryStrategy: defaultRetryStrategy
        });
        this.importService = getImportService({
            log: config.log,
            environmentId: config.targetEnvironment.id,
            managementApiKey: config.targetEnvironment.apiKey,
            skipFailedItems: config.targetEnvironment.skipFailedItems ?? false,
            retryStrategy: defaultRetryStrategy
        });
    }

    async migrateAsync(): Promise<void> {
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
                const exportData = await this.exportAdapter.exportAsync();
                await this.importService.importAsync(exportData);
            }
        });
    }
}
