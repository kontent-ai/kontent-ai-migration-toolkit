import chalk from 'chalk';
import { Logger } from '../core/index.js';
import { promises } from 'fs';

export function fileManager(logger: Logger) {
    const getFilePath = (filename: string): string => {
        return `./${filename}`;
    };

    const loadFileAsync = async (filename: string): Promise<Buffer> => {
        const filePath = getFilePath(filename);

        logger.log({
            type: 'readFs',
            message: `Reading file '${chalk.yellow(filePath)}'`
        });

        const file = await promises.readFile(filePath);

        return file;
    };

    const writeFileAsync = async (fileNameWithoutExtension: string, content: string | Buffer): Promise<void> => {
        const filePath = getFilePath(fileNameWithoutExtension);

        logger.log({
            type: 'writeFs',
            message: `Storing file '${chalk.yellow(filePath)}'`
        });
        await promises.writeFile(filePath, content);
    };

    return {
        loadFileAsync,
        writeFileAsync
    };
}
