import chalk from 'chalk';
import { ItemInfo } from '../models/core.models.js';
import { LogSpinnerData, Logger } from '../models/log.models.js';

export interface Chunk<T> {
    readonly items: T[];
    readonly index: number;
}

export async function processInChunksAsync<InputItem, OutputItem>(data: {
    readonly logger: Logger;
    readonly items: InputItem[];
    readonly chunkSize: number;
    readonly processAsync: (item: InputItem, logSpinner: LogSpinnerData) => Promise<OutputItem>;
    readonly itemInfo: (item: InputItem) => ItemInfo;
}): Promise<OutputItem[]> {
    if (!data.items.length) {
        return [];
    }

    const chunks = splitArrayIntoChunks<InputItem>(data.items, data.chunkSize);
    const outputItems: OutputItem[] = [];

    return await data.logger.logWithSpinnerAsync(async (logSpinner) => {
        let index: number = 1;

        for (const chunk of chunks) {
            await Promise.all(
                chunk.items.map((item) => {
                    const itemInfo = data.itemInfo(item);
                    const countPrefix = getCountPrefix(index, data.items.length);

                    logSpinner({
                        prefix: countPrefix,
                        message: itemInfo.title,
                        type: itemInfo.itemType
                    });

                    index++;

                    return data.processAsync(item, logSpinner).then((output) => {
                        outputItems.push(output);
                    });
                })
            );
        }

        return outputItems;
    });
}

function getCountPrefix(index: number, totalCount: number): string {
    return `${chalk.cyan(`${index}/${totalCount}`)}`;
}

function splitArrayIntoChunks<T>(items: T[], chunkSize: number): Chunk<T>[] {
    if (!items.length) {
        return [];
    }

    const chunks: Chunk<T>[] = [];

    for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        chunks.push({
            index: i,
            items: chunk
        });
    }

    return chunks;
}
