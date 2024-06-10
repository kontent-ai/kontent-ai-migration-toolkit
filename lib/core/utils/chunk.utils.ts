import { IItemInfo } from '../models/core.models.js';
import { ILogData, ILogSpinner, Log } from './log.utils.js';

export interface IChunk<T> {
    items: T[];
    index: number;
}

export async function processInChunksAsync<TInputItem, TOutputItem>(data: {
    log: Log;
    items: TInputItem[];
    chunkSize: number;
    processAsync: (item: TInputItem, spinner?: ILogSpinner) => Promise<TOutputItem>;
    itemInfo?: (item: TInputItem) => IItemInfo;
}): Promise<TOutputItem[]> {
    const chunks = splitArrayIntoChunks<TInputItem>(data.items, data.chunkSize);
    const outputItems: TOutputItem[] = [];

    const spinner = await data.log.spinner?.(data.items.length);
    await spinner?.startAsync();

    try {
        for (const chunk of chunks) {
            await Promise.all(
                chunk.items.map((item) => {
                    spinner?.nextItem();
                    let logData: ILogData | undefined;

                    if (data.itemInfo) {
                        const itemInfo = data.itemInfo(item);
                        logData = {
                            message: itemInfo.title,
                            type: itemInfo.itemType
                        };
                    }

                    return data.processAsync(item, spinner).then((output) => {
                        if (logData) {
                            if (spinner) {
                                spinner.logAsync(logData);
                            } else {
                                data.log.default(logData);
                            }
                        }

                        outputItems.push(output);
                    });
                })
            );
        }

        return outputItems;
    } finally {
        await spinner?.stopAsync();
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
