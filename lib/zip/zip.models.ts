import { Buffer as BufferProxy } from 'buffer';
import { Logger } from '../core/index.js';

export type FileBinaryData = BufferProxy | Blob;
export type ZipCompressionLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type ZipPackager = {
    addFile(filePath: string, data: string | FileBinaryData): void;
    addFolder(name: string): ZipPackager;
    generateZipAsync(config: { readonly logger?: Logger; readonly compressionLevel?: ZipCompressionLevel }): Promise<FileBinaryData>;
    getBinaryDataAsync(filePath: string): Promise<FileBinaryData | undefined>;
    getFileContentAsync(filePath: string): Promise<string | undefined>;
};
