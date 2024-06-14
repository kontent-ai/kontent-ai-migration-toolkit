import { libMetadata } from '../metadata.js';
import { Logger, executeWithTrackingAsync, getDefaultLogger } from '../core/index.js';
import {
    DefaultExportAdapter,
    DefaultExportAdapterConfig,
    ExportAdapter,
    ExportAdapterResult
} from '../export/index.js';

export interface ExportConfig {
    readonly logger?: Logger;
}

export interface DefaultExportConfig extends ExportConfig {
    readonly adapterConfig: Omit<DefaultExportAdapterConfig, 'logger'>;
}

export async function exportAsync(config: DefaultExportConfig): Promise<ExportAdapterResult>;
export async function exportAsync(adapter: ExportAdapter, config?: ExportConfig): Promise<ExportAdapterResult>;
export async function exportAsync(
    inputAdapterOrDefaultConfig: DefaultExportConfig | ExportAdapter,
    inputConfig?: ExportConfig
): Promise<ExportAdapterResult> {
    const { adapter } = getSetup(inputAdapterOrDefaultConfig, inputConfig);

    return await executeWithTrackingAsync({
        event: {
            tool: 'migrationToolkit',
            package: {
                name: libMetadata.name,
                version: libMetadata.version
            },
            action: 'export',
            relatedEnvironmentId: undefined,
            details: {
                adapter: adapter.name
            }
        },
        func: async () => {
            return await adapter.exportAsync();
        }
    });
}

function getSetup<TConfig extends ExportConfig, TDefaultConfig extends DefaultExportConfig & TConfig>(
    inputAdapterOrDefaultConfig: TDefaultConfig | ExportAdapter,
    inputConfig?: TConfig
): {
    adapter: ExportAdapter;
    config: TConfig;
    logger: Logger;
} {
    let adapter: ExportAdapter;
    let config: TConfig;
    let logger: Logger;

    if ((inputAdapterOrDefaultConfig as ExportAdapter)?.name) {
        adapter = inputAdapterOrDefaultConfig as ExportAdapter;
        config = (inputConfig as TConfig) ?? {};
        logger = config.logger ?? getDefaultLogger();
    } else {
        config = (inputAdapterOrDefaultConfig as TDefaultConfig) ?? {};
        logger = config.logger ?? getDefaultLogger();

        adapter = new DefaultExportAdapter({
            ...(inputAdapterOrDefaultConfig as TDefaultConfig).adapterConfig,
            logger: logger
        });
    }

    return {
        adapter,
        config,
        logger
    };
}
