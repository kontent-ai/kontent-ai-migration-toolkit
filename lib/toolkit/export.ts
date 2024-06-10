import { libMetadata } from '../metadata.js';
import {  ILogger, executeWithTrackingAsync, getDefaultLogger } from '../core/index.js';
import {
    IDefaultExportAdapterConfig,
    IExportAdapter,
    IExportAdapterResult,
    getDefaultExportAdapter
} from '../export/index.js';

export interface IExportConfig {
    logger?: ILogger;
}

export interface IDefaultExportConfig extends IExportConfig {
    adapterConfig: Omit<IDefaultExportAdapterConfig, 'logger'>;
}

export async function exportAsync(config: IDefaultExportConfig): Promise<IExportAdapterResult>;
export async function exportAsync(adapter: IExportAdapter, config?: IExportConfig): Promise<IExportAdapterResult>;
export async function exportAsync(
    inputAdapterOrDefaultConfig: IDefaultExportConfig | IExportAdapter,
    inputConfig?: IExportConfig
): Promise<IExportAdapterResult> {
    const { adapter } = await getSetupAsync(inputAdapterOrDefaultConfig, inputConfig);

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

async function getSetupAsync<TConfig extends IExportConfig, TDefaultConfig extends IDefaultExportConfig & TConfig>(
    inputAdapterOrDefaultConfig: TDefaultConfig | IExportAdapter,
    inputConfig?: TConfig
): Promise<{
    adapter: IExportAdapter;
    config: TConfig;
    logger: ILogger;
}> {
    let adapter: IExportAdapter;
    let config: TConfig;
    let logger: ILogger;

    if ((inputAdapterOrDefaultConfig as IExportAdapter)?.name) {
        adapter = inputAdapterOrDefaultConfig as IExportAdapter;
        config = (inputConfig as TConfig) ?? {};
        logger = config.logger ?? getDefaultLogger();
    } else {
        config = (inputAdapterOrDefaultConfig as unknown as TDefaultConfig) ?? {};
        logger = config.logger ?? getDefaultLogger();

        adapter = getDefaultExportAdapter({
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
