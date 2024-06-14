import JSZip from 'jszip';
import chalk from 'chalk';
import { Logger, formatBytes, getCurrentEnvironment, exitProgram } from '../core/index.js';
import { FileBinaryData, ZipCompressionLevel, ZipContext } from './zip.models.js';
import {} from 'browser-or-node';

type ZipFileType = string | Blob | Buffer | Uint8Array | number[] | ArrayBuffer;

interface FileResult<TFileType extends ZipFileType> {
    readonly data: TFileType;
    readonly filename: string;
}

export class ZipPackage {
    private readonly compressionLevel: ZipCompressionLevel = 9;

    constructor(
        private readonly jsZip: JSZip,
        private readonly logger: Logger,
        private readonly context?: ZipContext
    ) {}

    addFile(filePath: string, data: string | Blob | Buffer): void {
        this.jsZip.file(filePath, data);
    }

    addFolder(name: string): void {
        this.jsZip.folder(name);
    }

    async getAllFilesAsync<TReturnType extends ZipFileType>(
        type: JSZip.OutputType
    ): Promise<FileResult<TReturnType>[]> {
        const files: FileResult<TReturnType>[] = [];

        for (const file of Object.values(this.jsZip.files)) {
            if (!file?.name) {
                continue;
            }
            if (file?.name?.endsWith('/')) {
                continue;
            }

            files.push({
                filename: file.name,
                // eslint-disable-next-line
                data: await file.async<any>(type)
            });
        }

        return files;
    }

    async getFileContentAsync(filePath: string): Promise<string | undefined> {
        return await this.jsZip.file(filePath)?.async('string');
    }

    async getBinaryDataAsync(filePath: string): Promise<FileBinaryData | undefined> {
        const binaryData = await this.jsZip.file(filePath)?.async(this.getZipOutputType(this.context));
        return binaryData;
    }

    async generateZipAsync(): Promise<FileBinaryData> {
        const zipOutputType = this.getZipOutputType(this.context);

        this.logger.log({
            type: 'info',
            message: `Creating zip file using '${zipOutputType}' with compression level '${this.compressionLevel.toString()}'`
        });

        const result = await this.jsZip.generateAsync({
            type: zipOutputType,
            compression: 'DEFLATE',
            compressionOptions: {
                level: this.compressionLevel
            },
            streamFiles: true
        });

        this.logger.log({
            type: 'info',
            message: `Zip successfully generated (${chalk.yellow(formatBytes(this.getZipSizeInBytes(result)))})`
        });

        return result;
    }

    private getZipOutputType(context?: ZipContext): 'nodebuffer' | 'blob' {
        if (!context) {
            const currentEnv = getCurrentEnvironment();

            if (currentEnv === 'browser') {
                return 'blob';
            }
            if (currentEnv === 'node') {
                return 'nodebuffer';
            }
        }

        if (context === 'browser') {
            return 'blob';
        }

        if (context === 'node') {
            return 'nodebuffer';
        }

        exitProgram({
            message: `Unsupported context '${context}'`
        });
    }

    private getZipSizeInBytes(zipData: Blob | Buffer): number {
        if (zipData instanceof Blob) {
            return zipData.size;
        } else if (zipData instanceof Buffer) {
            return zipData.byteLength;
        }

        exitProgram({
            message: `Unrecognized zip data type '${typeof zipData}'`
        });
    }
}
