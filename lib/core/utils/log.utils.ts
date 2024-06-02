import chalk from 'chalk';
import ora from 'ora';
import { ActionType, FetchItemType, ItemType } from '../models/core.models.js';

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

export function logFetchedItems(data: { count: number; itemType: FetchItemType; log: Log }): void {
    data.log.console({
        type: 'info',
        message: `Fetched '${chalk.yellow(data.count.toString())}' ${data.itemType}`
    });
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
    let typeColor = chalk.yellow;

    if (data.type === 'info') {
        typeColor = chalk.cyan;
    } else if (
        data.type === 'error' ||
        data.type === 'errorData' ||
        data.type === 'warning' ||
        data.type === 'cancel'
    ) {
        typeColor = chalk.red;
    } else if (data.type === 'completed') {
        typeColor = chalk.green;
    } else if (data.type === 'skip') {
        typeColor = chalk.gray;
    }

    if (data.count) {
        return `${typeColor(`${data.count.index}/${data.count.total}`)}: ${data.message} ${chalk.cyan(data.type)} `;
    }
    return `${typeColor(data.type)}: ${data.message}`;
}
