import colors from 'colors';
import ora, { Ora } from 'ora';

import { ActionType } from './core.models.js';

interface ILogData {
    type: DebugType;
    message: string;
    count?: {
        index: number;
        total: number;
    };
}

export type Log = (data: ILogData) => void;

export type DebugType = 'error' | 'completed' | 'warning' | 'info' | 'errorData' | 'cancel' | 'process' | ActionType;

export function logErrorAndExit(data: { message: string }): never {
    throw Error(data.message);
}

export async function withDefaultLogAsync(func: (log: Log) => Promise<void>): Promise<void> {
    const spinner = ora('Processing ...').start();

    try {
        const log = getDefaultLog(spinner);
        await func(log);
    } catch (error) {
        throw error;
    } finally {
        spinner.clear();
        spinner.stop();
    }
}

export function getLogForPrompt(): Log {
    return (data) => {
        console.log(getLogDataMessage(data));
    };
}

function getDefaultLog(ora: Ora): Log {
    return (data) => {
        const message = getLogDataMessage(data);

        if (data.count) {
            ora.text = message;
        } else {
            ora.clear();
            console.log(message);
        }
    };
}

function getLogDataMessage(data: ILogData): string {
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
        return `${typeColor(`${data.count.index}/${data.count.total}`)}: ${data.message}`;
    }
    return `${typeColor(data.type)}: ${data.message}`;
}
