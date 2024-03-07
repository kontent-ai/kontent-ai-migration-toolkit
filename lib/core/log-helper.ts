import colors from 'colors';

import { ActionType, ItemType } from './core.models.js';
import ora from 'ora';

interface ILogCount {
    index: number;
    total: number;
}

interface ILogData {
    type: DebugType;
    message: string;
    count?: ILogCount;
}

export type Log = {
    spinner?: Spinner;
    console: Console;
};
export type Spinner = {
    start: () => void;
    stop: () => void;
    text: (data: ILogData) => void;
};
export type Console = (data: ILogData) => void;

export type DebugType =
    | 'error'
    | 'completed'
    | 'warning'
    | 'info'
    | 'errorData'
    | 'cancel'
    | 'process'
    | ActionType
    | ItemType;

export function logErrorAndExit(data: { message: string }): never {
    throw Error(data.message);
}

export async function withDefaultLogAsync(func: (log: Log) => Promise<void>): Promise<void> {
    const log = getDefaultLog();
    await func(log);
}

export function getDefaultLog(): Log {
    const spinner = ora();
    let previousCount: ILogCount | undefined = undefined;

    return {
        console: (data) => console.log(getLogDataMessage(data)),
        spinner: {
            start: () => spinner.start(),
            stop: () => spinner.stop(),
            text: (data) => {
                if (data.count) {
                    previousCount = data.count;
                }

                const message = getLogDataMessage({
                    message: data.message,
                    type: data.type,
                    count: data.count ?? previousCount
                });

                spinner.text = message;
            }
        }
    };
}

export function getLogDataMessage(data: ILogData): string {
    let typeColor = colors.yellow;

    if (data.type === 'info') {
        typeColor = colors.cyan;
    } else if (
        data.type === 'error' ||
        data.type === 'errorData' ||
        data.type === 'warning' ||
        data.type === 'cancel'
    ) {
        typeColor = colors.red;
    } else if (data.type === 'completed') {
        typeColor = colors.green;
    } else if (data.type === 'skip') {
        typeColor = colors.gray;
    }

    if (data.count) {
        return `${typeColor(`${data.count.index}/${data.count.total}`)}: ${data.message} ${colors.cyan(data.type)} `;
    }
    return `${typeColor(data.type)}: ${data.message}`;
}
