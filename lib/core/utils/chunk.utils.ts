import { ItemType } from '../models/core.models.js';
import { Log, logSpinner, startSpinner, stopSpinner } from './log.utils.js';

export interface IChunk<T> {
    items: T[];
    index: number;
}

export interface IProcessInChunksItemInfo {
    title: string;
    itemType: ItemType;
}

export function processWithSpinner<TInputItem, TOutputItem>(data: {
    type: ItemType;
    log: Log;
    items: TInputItem[];
    process: (item: TInputItem) => TOutputItem;
    itemInfo?: (item: TInputItem) => IProcessInChunksItemInfo;
}): TOutputItem[] {
    const outputItems: TOutputItem[] = [];
    let processingIndex: number = 0;

    startSpinner(data.log);

    try {
        for (const item of data.items) {
            processingIndex++;
            if (data.itemInfo) {
                const itemInfo = data.itemInfo(item);

                logSpinner(
                    {
                        message: itemInfo.title,
                        type: data.type,
                        count: {
                            index: processingIndex,
                            total: data.items.length
                        }
                    },
                    data.log
                );
            }

            outputItems.push(data.process(item));
        }

        return outputItems;
    } finally {
        stopSpinner(data.log);
    }
}

export async function processInChunksAsync<TInputItem, TOutputItem>(data: {
    type: ItemType;
    log: Log;
    items: TInputItem[];
    chunkSize: number;
    processFunc: (item: TInputItem) => Promise<TOutputItem>;
    itemInfo?: (item: TInputItem) => IProcessInChunksItemInfo;
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
                                type: data.type,
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
