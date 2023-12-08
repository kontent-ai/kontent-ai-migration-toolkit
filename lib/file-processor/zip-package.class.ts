import JSZip from 'jszip';
import { formatBytes, logDebug, logErrorAndExit } from '../core/index.js';
import { FileBinaryData, ZipCompressionLevel, ZipContext } from './file-processor.models.js';

interface IFileResult<T> {
    data: T;
    filename: string;
}

export class ZipPackage {
    private readonly context: ZipContext = 'node.js';
    private readonly compressionLevel: ZipCompressionLevel = 9;

    constructor(private readonly jsZip: JSZip) {}

    addFile(filePath: string, data: any): void {
        this.jsZip.file(filePath, data);
    }

    addFolder(name: string): void {
        this.jsZip.folder(name);
    }

    async getAllFilesAsync<TReturnType>(type: JSZip.OutputType): Promise<IFileResult<TReturnType>[]> {
        const files: IFileResult<TReturnType>[] = [];

        for (const file of Object.values(this.jsZip.files)) {
            if (!file?.name) {
                continue;
            }
            if (file?.name?.endsWith('/')) {
                continue;
            }

            files.push({
                filename: file.name,
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

        logDebug({
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

        logDebug({
            type: 'info',
            message: `Zip successfully generated`,
            partA: formatBytes(this.getZipSizeInBytes(result))
        });

        return result;
    }

    private getZipOutputType(context: ZipContext): 'nodebuffer' | 'blob' {
        if (context === 'browser') {
            return 'blob';
        }

        if (context === 'node.js') {
            return 'nodebuffer';
        }

        logErrorAndExit({
            message: `Unsupported context '${context}'`
        });
    }

    private getZipSizeInBytes(zipData: any): number {
        if (zipData instanceof Blob) {
            return zipData.size;
        } else if (zipData instanceof Buffer) {
            return zipData.byteLength;
        }

        logErrorAndExit({
            message: `Unrecognized zip data type '${typeof zipData}'`
        });
    }
}
