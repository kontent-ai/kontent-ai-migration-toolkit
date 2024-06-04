import { IItemInfo } from '../models/core.models.js';
import { Log, logSpinner, startSpinner, stopSpinner } from './log.utils.js';

export interface IChunk<T> {
    items: T[];
    index: number;
}

export async function processInChunksAsync<TInputItem, TOutputItem>(data: {
    log: Log;
    items: TInputItem[];
    chunkSize: number;
    processFunc: (item: TInputItem) => Promise<TOutputItem>;
    itemInfo?: (item: TInputItem) => IItemInfo;
}): Promise<TOutputItem[]> {
    const chunks = splitArrayIntoChunks<TInputItem>(data.items, data.chunkSize);
    const outputItems: TOutputItem[] = [];
    let processingIndex: number = 0;

    startSpinner(data.log);

    try {
        for (const chunk of chunks) {
            await Promise.all(
                chunk.items.map((item) => {
                    processingIndex++;

                    if (data.itemInfo) {
                        const itemInfo = data.itemInfo(item);

                        logSpinner(
                            {
                                message: itemInfo.title,
                                type: 'process',
                                count: {
                                    index: processingIndex,
                                    total: data.items.length
                                }
                            },
                            data.log
                        );
                    }
                    return data.processFunc(item).then((output) => {
                        outputItems.push(output);
                    });
                })
            );
        }

        return outputItems;
    } finally {
        stopSpinner(data.log);
    }
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
