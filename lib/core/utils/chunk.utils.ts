import { IItemInfo } from '../models/core.models.js';
import { ILogger, LogSpinnerData, getCountPrefix } from './log.utils.js';

export interface IChunk<T> {
    items: T[];
    index: number;
}

export async function processInChunksAsync<TInputItem, TOutputItem>(data: {
    logger: ILogger;
    items: TInputItem[];
    chunkSize: number;
    processAsync: (item: TInputItem, logSpinner: LogSpinnerData) => Promise<TOutputItem>;
    itemInfo: (item: TInputItem) => IItemInfo;
}): Promise<TOutputItem[]> {
    if (!data.items.length) {
        return [];
    }

    const chunks = splitArrayIntoChunks<TInputItem>(data.items, data.chunkSize);
    const outputItems: TOutputItem[] = [];

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

function splitArrayIntoChunks<T>(items: T[], chunkSize: number): IChunk<T>[] {
    if (!items.length) {
        return [];
    }

    const chunks: IChunk<T>[] = [];

    for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        chunks.push({
            index: i,
            items: chunk
        });
    }

    return chunks;
}
