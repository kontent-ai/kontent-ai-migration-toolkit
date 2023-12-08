import JSZip from 'jszip';
import { formatBytes, logDebug, logErrorAndExit } from '../core/index.js';
import { BinaryData, ZipContext } from './file-processor.models.js';

export class ZipService {
    private readonly context: ZipContext = 'node.js';
    private readonly compressionLevel: number = 9;

    constructor(private readonly zip: JSZip) {}

    addFile(filePath: string, data: any): void {
        this.zip.file(filePath, data);
    }

    addFolder(name: string): void {
        this.zip.folder(name);
    }

    async getFileContentAsync(filePath: string): Promise<string | undefined> {
        return await this.zip.file(filePath)?.async('string');
    }

    async getBinaryDataAsync(filePath: string): Promise<BinaryData | undefined> {
        const binaryData = await this.zip.file(filePath)?.async(this.getZipOutputType(this.context));
        return binaryData;
    }

    async generateZipAsync(): Promise<BinaryData> {
        const zipOutputType = this.getZipOutputType(this.context);

        logDebug({
            type: 'info',
            message: `Creating zip file using '${zipOutputType}' with compression level '${this.compressionLevel.toString()}'`
        });

        const result = await this.zip.generateAsync({
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
