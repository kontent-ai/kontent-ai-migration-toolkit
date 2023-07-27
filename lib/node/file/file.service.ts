import { promises } from 'fs';
import { logDebug } from '../../core/log-helper';

export class FileService {
    constructor() {}

    async loadFileAsync(filename: string): Promise<Buffer> {
        const filePath = this.getFilePath(filename);

        logDebug('read', filePath);
        const file = await promises.readFile(filePath);

        return file;
    }

    async writeFileAsync(fileNameWithoutExtension: string, content: any): Promise<void> {
        const filePath = this.getFilePath(fileNameWithoutExtension);

        await promises.writeFile(filePath, content);
        logDebug('save', filePath);
    }

    private getFilePath(filename: string) {
        return `./${filename}`;
    }
}
