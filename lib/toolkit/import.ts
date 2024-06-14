import { Logger, executeWithTrackingAsync, getDefaultLogger } from '../core/index.js';
import { DefaultImportAdapter, DefaultImportAdapterConfig, ImportAdapter, ImportData } from '../import/index.js';
import { libMetadata } from '../metadata.js';

export interface ImportConfig {
    readonly logger?: Logger;
    readonly data: ImportData;
}

export interface DefaultImportConfig extends ImportConfig {
    readonly adapterConfig: Omit<DefaultImportAdapterConfig, 'logger'>;
}

export async function importAsync(config: DefaultImportConfig): Promise<void>;
export async function importAsync(adapter: ImportAdapter, config?: ImportConfig): Promise<void>;
export async function importAsync(
    inputAdapterOrDefaultConfig: DefaultImportConfig | ImportAdapter,
    inputConfig?: ImportConfig
): Promise<void> {
    const { adapter, config } = getSetup(inputAdapterOrDefaultConfig, inputConfig);

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

function getSetup<TConfig extends ImportConfig, TDefaultConfig extends DefaultImportConfig & TConfig>(
    inputAdapterOrDefaultConfig: TDefaultConfig | ImportAdapter,
    inputConfig?: TConfig
): {
    adapter: ImportAdapter;
    config: TConfig;
    logger: Logger;
} {
    let adapter: ImportAdapter;
    let config: TConfig;
    let logger: Logger;

    if ((inputAdapterOrDefaultConfig as ImportAdapter)?.name) {
        adapter = inputAdapterOrDefaultConfig as ImportAdapter;
        config = (inputConfig as TConfig) ?? {};
        logger = config.logger ?? getDefaultLogger();
    } else {
        config = (inputAdapterOrDefaultConfig as TDefaultConfig) ?? {};
        logger = config.logger ?? getDefaultLogger();

        adapter = new DefaultImportAdapter({
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
