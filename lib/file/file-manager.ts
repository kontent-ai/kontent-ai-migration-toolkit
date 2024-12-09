import { Buffer as BufferProxy } from 'buffer';
import chalk from 'chalk';
import { promises } from 'fs';
import { Logger } from '../core/index.js';

export function fileManager(logger: Logger) {
    const getFilePath = (filename: string): string => {
        return `./${filename}`;
    };

    const loadFileAsync = async (filename: string): Promise<BufferProxy> => {
        const filePath = getFilePath(filename);

        logger.log({
            type: 'readFs',
            message: `Reading file '${chalk.yellow(filePath)}'`
        });

        const file = await promises.readFile(filePath);

        return file;
    };

    const writeFileAsync = async (fileNameWithoutExtension: string, content: string | BufferProxy): Promise<void> => {
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
