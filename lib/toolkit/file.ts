import { Buffer as BufferProxy } from 'buffer';
import { defaultZipFilename, executeWithTrackingAsync, getDefaultLogger, Logger, MigrationData } from '../core/index.js';
import { fileManager } from '../file/index.js';
import { libMetadata } from '../metadata.js';
import { zipManager } from '../zip/index.js';

export interface StoreConfig {
    readonly data: MigrationData;
    readonly filename?: string;
    readonly logger?: Logger;
}

export interface ExtractConfig {
    readonly filename?: string;
    readonly logger?: Logger;
}

export async function storeAsync(config: StoreConfig): Promise<void> {
    const logger = config.logger ?? getDefaultLogger();
    const filename = config.filename ?? defaultZipFilename;

    await executeWithTrackingAsync<void>({
        event: {
            tool: 'migrationToolkit',
            package: {
                name: libMetadata.name,
                version: libMetadata.version
            },
            action: 'store',
            relatedEnvironmentId: undefined,
            details: {}
        },
        func: async () => {
            const zipData = await zipManager(logger).createZipAsync(config.data);

            if (zipData instanceof BufferProxy) {
                await fileManager(logger).writeFileAsync(filename, zipData);
            } else {
                throw Error(`Cannot store '${filename}' on File system because the provided zip is not a Buffer`);
            }
        },
        logger: config.logger
    });
}

export async function extractAsync(config: ExtractConfig): Promise<MigrationData> {
    const logger = config.logger ?? getDefaultLogger();
    const filename = config.filename ?? defaultZipFilename;

    return await executeWithTrackingAsync({
        event: {
            tool: 'migrationToolkit',
            package: {
                name: libMetadata.name,
                version: libMetadata.version
            },
            action: 'extract',
            relatedEnvironmentId: undefined,
            details: {}
        },
        func: async () => {
            const fileData = await fileManager(logger).loadFileAsync(filename);
            return await zipManager(logger).parseZipAsync(fileData);
        },
        logger: config.logger
    });
}
