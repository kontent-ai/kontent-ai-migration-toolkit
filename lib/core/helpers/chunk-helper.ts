import { ItemType } from '../models/core.models.js';
import { Log } from './log-helper.js';

export interface IChunk<T> {
    items: T[];
    index: number;
}

export interface IProcessInChunksItemInfo {
    title: string;
    itemType: ItemType;
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

    data?.log.spinner?.start();

    try {
        for (const chunk of chunks) {
            await Promise.all(
                chunk.items.map((item) => {
                    processingIndex++;

                    if (data.itemInfo) {
                        const itemInfo = data.itemInfo(item);

                        if (data.log.spinner) {
                            data?.log.spinner?.text?.({
                                message: itemInfo.title,
                                type: data.type,
                                count: {
                                    index: processingIndex,
                                    total: data.items.length
                                }
                            });
                        } else {
                            data.log.console({
                                message: itemInfo.title,
                                type: data.type,
                                count: {
                                    index: processingIndex,
                                    total: data.items.length
                                }
                            });
                        }
                    }
                    return data.processFunc(item).then((output) => {
                        outputItems.push(output);
                    });
                })
            );
        }

        return outputItems;
    } finally {
        data?.log.spinner?.stop();
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
