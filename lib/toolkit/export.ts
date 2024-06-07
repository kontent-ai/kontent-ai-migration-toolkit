import { libMetadata } from '../metadata.js';
import { Log, executeWithTrackingAsync, getDefaultLogAsync } from '../core/index.js';
import {
    IDefaultExportAdapterConfig,
    IExportAdapter,
    IExportAdapterResult,
    getDefaultExportAdapter
} from '../export/index.js';

export interface IExportConfig {
    log?: Log;
}

export interface IDefaultExportConfig extends IExportConfig {
    adapterConfig: Omit<IDefaultExportAdapterConfig, 'log'>;
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
    log: Log;
}> {
    let adapter: IExportAdapter;
    let config: TConfig;
    let log: Log;

    if ((inputAdapterOrDefaultConfig as IExportAdapter)?.name) {
        adapter = inputAdapterOrDefaultConfig as IExportAdapter;
        config = (inputConfig as TConfig) ?? {};
        log = config.log ?? (await getDefaultLogAsync());
    } else {
        config = (inputAdapterOrDefaultConfig as unknown as TDefaultConfig) ?? {};
        log = config.log ?? (await getDefaultLogAsync());

        adapter = getDefaultExportAdapter({
            ...(inputAdapterOrDefaultConfig as TDefaultConfig).adapterConfig,
            log: log
        });
    }

    return {
        adapter,
        config,
        log
    };
}
