import chalk from 'chalk';
import { ActionType, FetchItemType, ItemType } from '../models/core.models.js';

export interface ILogCount {
    index: number;
    total: number;
}

export interface ILogData {
    type: DebugType;
    message: string;
    count?: ILogCount;
}

export type Log = {
    spinner?: Spinner;
    logger: Logger;
};
export type Spinner = {
    start: () => void;
    stop: () => void;
    text: (data: ILogData) => void;
};
export type Logger = (data: ILogData) => void;

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

export function startSpinner(log: Log): void {
    log.spinner?.start();
}

export function stopSpinner(log: Log): void {
    log.spinner?.stop();
}

export function logSpinner(data: ILogData, log: Log): void {
    if (log.spinner) {
        log.spinner.text(data);
    } else {
        log.logger(data);
    }
}

export function logErrorAndExit(data: { message: string }): never {
    throw Error(data.message);
}

export function logFetchedItems(data: { count: number; itemType: FetchItemType; log: Log }): void {
    data.log.logger({
        type: 'info',
        message: `Fetched '${chalk.yellow(data.count.toString())}' ${data.itemType}`
    });
}

export async function getDefaultLogAsync(): Promise<Log> {
    // Ora is imported dynamically because it's a node.js only module and would not work if user
    // tried using this library in a browser
    const ora = await import('ora');
    const spinner = ora.default();
    let previousCount: ILogCount | undefined = undefined;

    return {
        logger: (data) => console.log(getLogDataMessage(data)),
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
