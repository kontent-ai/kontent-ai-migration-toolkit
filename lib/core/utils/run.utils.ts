import chalk from 'chalk';
import { MapiAction, MapiType } from '../models/core.models.js';
import { ILogData, ILogSpinner, Log, logSpinnerOrDefaultAsync } from './log.utils.js';

export async function runMapiRequestAsync<TResult>(data: {
    log: Log;
    spinner?: ILogSpinner;
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

    await logSpinnerOrDefaultAsync({
        spinner: data.spinner,
        log: data.log,
        logData: logData
    });

    const result = await data.func();

    if (Array.isArray(result) && data.action === 'list') {
        const logData: ILogData = {
            message: `Fetched '${chalk.yellow(result.length)}' ${data.type}${result.length !== 1 ? 's' : ''}`,
            type: data.action
        };

        await logSpinnerOrDefaultAsync({
            spinner: data.spinner,
            log: data.log,
            logData: logData
        });
    }

    return result;
}
