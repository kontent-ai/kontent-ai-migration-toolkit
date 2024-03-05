import { promises } from 'fs';
import colors from 'colors';
import { Log } from '../core/index.js';

export function getFileService(log?: Log): FileService {
    return new FileService(log);
}

export class FileService {
    constructor(private readonly log?: Log) {}

    async loadFileAsync(filename: string): Promise<Buffer> {
        const filePath = this.getFilePath(filename);

        this.log?.console?.({
            type: 'readFs',
            message: `Reading file '${colors.yellow(filePath)}'`
        });

        const file = await promises.readFile(filePath);

        return file;
    }

    async writeFileAsync(fileNameWithoutExtension: string, content: any): Promise<void> {
        const filePath = this.getFilePath(fileNameWithoutExtension);

        this.log?.console?.({
            type: 'writeFs',
            message: `Storing file '${colors.yellow(filePath)}'`
        });
        await promises.writeFile(filePath, content);
    }

    private getFilePath(filename: string) {
        return `./${filename}`;
    }
}
