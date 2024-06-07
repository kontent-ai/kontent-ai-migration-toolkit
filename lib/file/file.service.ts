import { promises } from 'fs';
import chalk from 'chalk';
import { Log } from '../core/index.js';

export function getFileService(log: Log): FileService {
    return new FileService(log);
}

export class FileService {
    constructor(private readonly log: Log) {}

    async loadFileAsync(filename: string): Promise<Buffer> {
        const filePath = this.getFilePath(filename);

        this.log.default({
            type: 'readFs',
            message: `Reading file '${chalk.yellow(filePath)}'`
        });

        const file = await promises.readFile(filePath);

        return file;
    }

    async writeFileAsync(fileNameWithoutExtension: string, content: any): Promise<void> {
        const filePath = this.getFilePath(fileNameWithoutExtension);

        this.log.default({
            type: 'writeFs',
            message: `Storing file '${chalk.yellow(filePath)}'`
        });
        await promises.writeFile(filePath, content);
    }

    private getFilePath(filename: string) {
        return `./${filename}`;
    }
}
