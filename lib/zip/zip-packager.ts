import JSZip from 'jszip';
import chalk from 'chalk';
import { Logger, formatBytes, getCurrentEnvironment, exitProgram, getDefaultLogger } from '../core/index.js';
import { FileBinaryData, ZipCompressionLevel, ZipPackager } from './zip.models.js';

export function zipPackager(jsZip: JSZip): ZipPackager {
    const getZipOutputType: () => 'nodebuffer' | 'blob' = () => {
        const currentEnv = getCurrentEnvironment();

        if (currentEnv === 'browser') {
            return 'blob';
        }
        if (currentEnv === 'node') {
            return 'nodebuffer';
        }

        exitProgram({
            message: `Unsupported context`
        });
    };

    const getZipSizeInBytes = (zipData: FileBinaryData) => {
        if (zipData instanceof Blob) {
            return zipData.size;
        } else if (zipData instanceof Buffer) {
            return zipData.byteLength;
        }

        exitProgram({
            message: `Unrecognized zip data type '${typeof zipData}'`
        });
    };

    return {
        addFile(filePath: string, data: string | FileBinaryData): JSZip {
            return jsZip.file(filePath, data);
        },
        addFolder(name: string): ZipPackager {
            const folder = jsZip.folder(name);

            if (!folder) {
                throw Error(`Failed to add folder '${name}'`);
            }

            return zipPackager(folder);
        },
        async generateZipAsync(config: {
            logger?: Logger;
            compressionLevel?: ZipCompressionLevel;
        }): Promise<FileBinaryData> {
            const logger = config.logger ?? getDefaultLogger();
            const zipOutputType = getZipOutputType();
            const compressionLevel: ZipCompressionLevel = config.compressionLevel ?? 9;

            logger.log({
                type: 'info',
                message: `Creating zip file using '${zipOutputType}' with compression level '${compressionLevel.toString()}'`
            });

            const result = await jsZip.generateAsync({
                type: zipOutputType,
                compression: 'DEFLATE',
                compressionOptions: {
                    level: compressionLevel
                },
                streamFiles: true
            });

            logger.log({
                type: 'info',
                message: `Zip successfully generated (${chalk.yellow(formatBytes(getZipSizeInBytes(result)))})`
            });

            return result;
        },
        async getBinaryDataAsync(filePath: string): Promise<FileBinaryData | undefined> {
            const binaryData = await jsZip.file(filePath)?.async(getZipOutputType());
            return binaryData;
        },
        async getFileContentAsync(filePath: string): Promise<string | undefined> {
            return await jsZip.file(filePath)?.async('string');
        }
    };
}
