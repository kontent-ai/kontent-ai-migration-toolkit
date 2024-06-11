import chalk from 'chalk';
import { MapiAction, MapiType } from '../models/core.models.js';
import { LogMessage, Logger, logSpinnerOrDefaultAsync, LogSpinnerData } from './log.utils.js';

export async function runMapiRequestAsync<TResult>(data: {
    logger: Logger;
    logSpinner?: LogSpinnerData;
    action: MapiAction;
    type: MapiType;
    func: () => Promise<TResult>;
    itemName?: string;
}): Promise<TResult> {
    let logData: LogMessage | undefined;

    if (data.action === 'list') {
        logData = {
            message: `Loading '${chalk.yellow(data.type)}' objects`,
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
        logSpinner: data.logSpinner,
        logger: data.logger,
        logData: logData
    });

    const result = await data.func();

    if (Array.isArray(result) && data.action === 'list') {
        const logData: LogMessage = {
            message: `Fetched '${chalk.yellow(result.length)}' objects of type '${chalk.yellow(data.type)}'`,
            type: data.action
        };

        await logSpinnerOrDefaultAsync({
            logSpinner: data.logSpinner,
            logger: data.logger,
            logData: logData
        });
    }

    return result;
}
