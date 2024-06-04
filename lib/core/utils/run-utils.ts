import chalk from 'chalk';
import { IItemInfo, MapiAction, MapiType } from '../models/core.models.js';
import { ILogData, Log, logSpinner, startSpinner, stopSpinner } from './log.utils.js';

export async function runMapiRequestAsync<TResult>(data: {
    log: Log;
    useSpinner: boolean;
    action: MapiAction;
    type: MapiType;
    func: () => Promise<TResult>;
    itemName?: string;
}): Promise<TResult> {
    let logData: ILogData | undefined;

    if (data.action === 'list') {
        logData = {
            message: `${data.type}${data.action === 'list' ? 's' : ''}`,
            type: data.action
        };
    } else if (data.itemName) {
        logData = {
            message: `${data.type} -> ${data.itemName}`,
            type: data.action
        };
    } else {
        logData = {
            message: `${data.type}`,
            type: data.action
        };
    }

    if (data.useSpinner) {
        logSpinner(logData, data.log);
    } else {
        data.log.logger(logData);
    }

    const result = await data.func();

    if (Array.isArray(result) && data.action === 'list') {
        const logData: ILogData = {
            message: `Fetched '${chalk.yellow(result.length)}' ${data.type}${result.length !== 1 ? 's' : ''}`,
            type: data.action
        };

        if (data.useSpinner) {
            logSpinner(logData, data.log);
        } else {
            data.log.logger(logData);
        }
    }

    return result;
}

export function runWithSpinner<TInputItem, TOutputItem>(data: {
    log: Log;
    items: TInputItem[];
    process: (item: TInputItem) => TOutputItem;
    itemInfo?: (item: TInputItem) => IItemInfo;
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
                        type: 'process',
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
