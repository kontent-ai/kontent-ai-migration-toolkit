import chalk from 'chalk';
import { GeneralActionType, GeneralItemType, MapiAction, MapiType } from '../models/core.models.js';
import { DefaultSpinner } from '../spinner/default-spinner.js';

export interface ILogCount {
    index: number;
    total: number;
}

export interface ILogData {
    type: DebugType;
    message: string;
}

export type Log = {
    spinner?: (totalCount: number) => ILogSpinner;
    default: (data: ILogData) => void;
};

export interface ILogSpinner {
    addCount(): void;
    startAsync(): Promise<void>;
    stopAsync(): Promise<void>;
    logAsync(data: ILogData): Promise<void>;
}

export type DebugType =
    | 'error'
    | 'completed'
    | 'warning'
    | 'info'
    | 'errorData'
    | 'cancel'
    | 'process'
    | MapiType
    | GeneralActionType
    | MapiAction
    | GeneralItemType;

export function logErrorAndExit(data: { message: string }): never {
    throw Error(data.message);
}

export async function getDefaultLogAsync(): Promise<Log> {
    return {
        default: (data) => console.log(getLogDataMessage(data)),
        spinner: (totalCount) => new DefaultSpinner(totalCount)
    };
}

export async function logSpinnerOrDefaultAsync(data: {
    spinner: ILogSpinner | undefined;
    logData: ILogData;
    log: Log;
}): Promise<void> {
    if (data.spinner) {
        await data.spinner.logAsync(data.logData);
    } else {
        await data.log.default(data.logData);
    }
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

    return `${typeColor(data.type)}: ${data.message}`;
}
