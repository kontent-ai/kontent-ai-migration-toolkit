import { promises } from 'fs';
import { logDebug } from '../core/index.js';

export class FileService {
    constructor() {}

    async loadFileAsync(filename: string): Promise<Buffer> {
        const filePath = this.getFilePath(filename);

        logDebug({
            type: 'readFs',
            message: `Reading file system`,
            partA: filePath
        });

        const file = await promises.readFile(filePath);

        return file;
    }

    async writeFileAsync(fileNameWithoutExtension: string, content: any): Promise<void> {
        const filePath = this.getFilePath(fileNameWithoutExtension);

        logDebug({
            type: 'writeFs',
            message: `Storing on file system`,
            partA: filePath
        });
        await promises.writeFile(filePath, content);
    }

    private getFilePath(filename: string) {
        return `./${filename}`;
    }
}
