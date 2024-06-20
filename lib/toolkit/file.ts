import { fileManager } from '../file/index.js';
import { Logger, executeWithTrackingAsync, getDefaultZipFilename, getDefaultLogger } from '../core/index.js';
import { ExportResult } from '../export/index.js';
import { ZipContext, zipManager } from '../zip/index.js';
import { libMetadata } from '../metadata.js';
import { ImportData } from '../import/index.js';

export interface StoreConfig {
    readonly data: ExportResult;
    readonly filename?: string;
    readonly zipContext?: ZipContext;
    readonly logger?: Logger;
}

export interface ExtractConfig {
    readonly filename?: string;
    readonly zipContext?: ZipContext;
    readonly logger?: Logger;
}

export async function storeAsync(config: StoreConfig): Promise<void> {
    const logger = config.logger ?? getDefaultLogger();
    const filename: string = getDefaultZipFilename();

    await executeWithTrackingAsync({
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
            const zipData = await zipManager(logger, config.zipContext).createZipAsync(config.data);

            if (zipData instanceof Buffer) {
                await fileManager(logger).writeFileAsync(filename, zipData);
            } else {
                throw Error(`Cannot store '${filename}' on File system because the provided zip is not a Buffer`);
            }
        }
    });
}

export async function extractAsync(config: ExtractConfig): Promise<ImportData> {
    const logger = config.logger ?? getDefaultLogger();
    const filename: string = getDefaultZipFilename();

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
            return await zipManager(logger, config.zipContext).parseZipAsync(fileData);
        }
    });
}
