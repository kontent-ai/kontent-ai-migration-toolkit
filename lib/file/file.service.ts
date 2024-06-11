import { promises } from 'fs';
import chalk from 'chalk';
import { Logger } from '../core/index.js';

export function getFileService(logger: Logger): FileService {
    return new FileService(logger);
}

export class FileService {
    constructor(private readonly logger: Logger) {}

    async loadFileAsync(filename: string): Promise<Buffer> {
        const filePath = this.getFilePath(filename);

        this.logger.log({
            type: 'readFs',
            message: `Reading file '${chalk.yellow(filePath)}'`
        });

        const file = await promises.readFile(filePath);

        return file;
    }

    async writeFileAsync(fileNameWithoutExtension: string, content: any): Promise<void> {
        const filePath = this.getFilePath(fileNameWithoutExtension);

        this.logger.log({
            type: 'writeFs',
            message: `Storing file '${chalk.yellow(filePath)}'`
        });
        await promises.writeFile(filePath, content);
    }

    private getFilePath(filename: string) {
        return `./${filename}`;
    }
}
