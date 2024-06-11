import { ItemInfo } from '../models/core.models.js';
import { Logger, LogSpinnerData, getCountPrefix } from './log.utils.js';

export interface Chunk<T> {
    items: T[];
    index: number;
}

export async function processInChunksAsync<InputItem, OutputItem>(data: {
    logger: Logger;
    items: InputItem[];
    chunkSize: number;
    processAsync: (item: InputItem, logSpinner: LogSpinnerData) => Promise<OutputItem>;
    itemInfo: (item: InputItem) => ItemInfo;
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
