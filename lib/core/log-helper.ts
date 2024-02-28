import colors from 'colors';
import ora, { Ora } from 'ora';

import { ActionType } from './core.models.js';
import { exitProcess } from './global-helper.js';

export type Log = (data: {
    type: DebugType;
    message: string;
    count?: {
        index: number;
        total: number;
    };
}) => void;

export type DebugType = 'error' | 'completed' | 'warning' | 'info' | 'errorData' | 'cancel' | 'process' | ActionType;

export function logErrorAndExit(data: { message: string }): never {
    console.log(`${colors.red('Error: ')} ${data.message}`);
    exitProcess();
}

export async function withDefaultLogAsync(func: (log: Log) => Promise<void>): Promise<void> {
    const spinner = ora('Processing ...').start();
    const log = getDefaultLog(spinner);

    await func(log);

    spinner.clear();
    spinner.stop();
}

function getDefaultLog(ora: Ora): Log {
    return (data) => {
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
        }

        if (data.count) {
            ora.text = `${typeColor(`${data.count.index}/${data.count.total}`)}: ${data.message}`;
        } else {
            const message = `${typeColor(data.type)}: ${data.message}`;
            ora.clear();
            console.log(message);
        }
    };
}
