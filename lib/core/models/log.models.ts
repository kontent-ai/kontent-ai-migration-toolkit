import { GeneralActionType, GeneralItemType, MapiAction, MapiType } from '../index.js';

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

export interface LogMessage {
    readonly type: DebugType;
    readonly message: string;
}

export interface LogSpinnerMessage extends LogMessage {
    readonly prefix?: string;
}

export type LogData = (data: LogMessage) => void;
export type LogSpinnerData = (data: LogSpinnerMessage) => void;

export interface Logger {
    logWithSpinnerAsync<T>(func: (logData: LogSpinnerData) => Promise<T>): Promise<T>;
    log: LogData;
}
