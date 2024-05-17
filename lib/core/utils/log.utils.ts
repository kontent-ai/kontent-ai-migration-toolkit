import colors from 'colors';
import prompts from 'prompts';
import ora from 'ora';
import { ManagementClient } from '@kontent-ai/management-sdk';
import { ActionType, FetchItemType, ItemType } from '../models/core.models.js';
import { exitProcess } from './global.utils.js';

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
        message: `Fetched '${colors.yellow(data.count.toString())}' ${data.itemType}`
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
        return `${typeColor(`${data.count.index}/${data.count.total}`)}: ${data.message} ${colors.cyan(data.type)} `;
    }
    return `${typeColor(data.type)}: ${data.message}`;
}

export async function confirmImportAsync(data: {
    force: boolean;
    environmentId: string;
    apiKey: string;
    log: Log;
}): Promise<void> {
    const targetEnvironment = (
        await new ManagementClient({
            apiKey: data.apiKey,
            environmentId: data.environmentId
        })
            .environmentInformation()
            .toPromise()
    ).data.project;

    if (data.force) {
        data.log.console({
            type: 'info',
            message: `Skipping confirmation prompt due to the use of force param`
        });
    } else {
        const confirmed = await prompts({
            type: 'confirm',
            name: 'confirm',
            message: `Are you sure to import data into ${colors.yellow(
                targetEnvironment.environment
            )} environment of project ${colors.cyan(targetEnvironment.name)}?`
        });

        if (!confirmed.confirm) {
            data.log.console({
                type: 'cancel',
                message: `Confirmation refused. Exiting process.`
            });
            exitProcess();
        }
    }
}
