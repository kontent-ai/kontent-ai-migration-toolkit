import { ILogger, executeWithTrackingAsync, getDefaultLogger } from '../core/index.js';
import { IDefaultImportAdapterConfig, IImportAdapter, IImportData, getDefaultImportAdapter } from '../import/index.js';
import { libMetadata } from '../metadata.js';

export interface IImportConfig {
    logger?: ILogger;
    data: IImportData;
}

export interface IDefaultImportConfig extends IImportConfig {
    adapterConfig: Omit<IDefaultImportAdapterConfig, 'logger'>;
}

export async function importAsync(config: IDefaultImportConfig): Promise<void>;
export async function importAsync(adapter: IImportAdapter, config?: IImportConfig): Promise<void>;
export async function importAsync(
    inputAdapterOrDefaultConfig: IDefaultImportConfig | IImportAdapter,
    inputConfig?: IImportConfig
): Promise<void> {
    const { adapter, config } = await getSetupAsync(inputAdapterOrDefaultConfig, inputConfig);

    return await executeWithTrackingAsync({
        event: {
            tool: 'migrationToolkit',
            package: {
                name: libMetadata.name,
                version: libMetadata.version
            },
            action: 'import',
            relatedEnvironmentId: undefined,
            details: {
                adapter: adapter.name
            }
        },
        func: async () => {
            await adapter.importAsync(config.data);
        }
    });
}

async function getSetupAsync<TConfig extends IImportConfig, TDefaultConfig extends IDefaultImportConfig & TConfig>(
    inputAdapterOrDefaultConfig: TDefaultConfig | IImportAdapter,
    inputConfig?: TConfig
): Promise<{
    adapter: IImportAdapter;
    config: TConfig;
    logger: ILogger;
}> {
    let adapter: IImportAdapter;
    let config: TConfig;
    let logger: ILogger;

    if ((inputAdapterOrDefaultConfig as IImportAdapter)?.name) {
        adapter = inputAdapterOrDefaultConfig as IImportAdapter;
        config = (inputConfig as TConfig) ?? {};
        logger = config.logger ?? getDefaultLogger();
    } else {
        config = (inputAdapterOrDefaultConfig as unknown as TDefaultConfig) ?? {};
        logger = config.logger ?? getDefaultLogger();

        adapter = getDefaultImportAdapter({
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
