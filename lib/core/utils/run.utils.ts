import chalk from 'chalk';
import { MapiAction, MapiType } from '../models/core.models.js';
import { LogMessage, LogSpinnerData, Logger } from '../models/log.models.js';

export async function runMapiRequestAsync<TResult>(data: {
    readonly logger: Logger;
    readonly logSpinner?: LogSpinnerData;
    readonly action: MapiAction;
    readonly type: MapiType;
    readonly func: () => Promise<TResult>;
    readonly itemName?: string;
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

    logSpinnerOrDefault({
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

        logSpinnerOrDefault({
            logSpinner: data.logSpinner,
            logger: data.logger,
            logData: logData
        });
    }

    return result;
}

function logSpinnerOrDefault(data: {
    readonly logSpinner: LogSpinnerData | undefined;
    readonly logData: LogMessage;
    readonly logger: Logger;
}): void {
    if (data.logSpinner) {
        data.logSpinner(data.logData);
    } else {
        data.logger.log(data.logData);
    }
}
