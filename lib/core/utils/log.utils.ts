import chalk from 'chalk';
import { GeneralActionType, GeneralItemType, MapiAction, MapiType } from '../models/core.models.js';

export interface ILogCount {
    index: number;
    total: number;
}

export interface ILogData {
    type: DebugType;
    message: string;
}

export interface ISpinnerLogData extends ILogData {
    prefix?: string;
}

export type LogData = (data: ILogData) => void;
export type LogSpinnerData = (data: ISpinnerLogData) => void;

export interface ILogger {
    logWithSpinnerAsync<T>(func: (logData: LogSpinnerData) => Promise<T>): Promise<T>;
    log: LogData;
}

export interface ILogSpinner {
    withSpinnerAsync<T>(func: (logData: LogSpinnerData) => Promise<T>): Promise<T>;

    nextItem(): void;
    start(): Promise<void> | void;
    stop(): Promise<void> | void;
    log(data: ILogData): Promise<void> | void;
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

export async function logSpinnerOrDefaultAsync(data: {
    logSpinner: LogSpinnerData | undefined;
    logData: ILogData;
    logger: ILogger;
}): Promise<void> {
    if (data.logSpinner) {
        await data.logSpinner(data.logData);
    } else {
        await data.logger.log(data.logData);
    }
}

export function getCountPrefix(index: number, totalCount: number): string {
    return `${chalk.cyan(`${index}/${totalCount}`)}`;
}

export function getLogDataMessage(data: ISpinnerLogData): string {
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
