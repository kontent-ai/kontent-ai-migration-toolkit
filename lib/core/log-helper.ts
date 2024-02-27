import colors from 'colors';

import { ActionType, ItemType, LogLevel } from './core.models.js';
import { exitProcess } from './global-helper.js';

export type DebugType = 'error' | 'warning' | 'info' | 'errorData' | 'cancel' | ActionType;

export function logErrorAndExit(data: { message: string }): never {
    logDebug({
        type: 'error',
        message: data.message
    });
    exitProcess();
}

export function logProcessingDebug(data: {
    index: number;
    totalCount: number;
    itemType: ItemType;
    title: string;
    partA?: string;
}): void {
    console.log(
        `[${colors.cyan(`${data.index}/${data.totalCount}`)}][${colors.yellow(data.itemType)}]${
            data.partA ? `[${colors.green(data.partA)}]` : ''
        }: ${data.title}`
    );
}

export function logDebug(data: {
    type: DebugType;
    message: string;
    partA?: string;
    partB?: string;
    partC?: string;
    partD?: string;
    performance?: string;
}): void {
    let typeColor: colors.Color = colors.green;

    if (data.type === 'error' || data.type === 'errorData') {
        typeColor = colors.red;
    } else if (data.type === 'info') {
        typeColor = colors.cyan;
    } else if (data.type === 'warning') {
        typeColor = colors.red;
    } else if (data.type === 'cancel') {
        typeColor = colors.red;
    }

    console.log(
        `[${typeColor(data.type)}]${data.partA ? `[${colors.yellow(data.partA)}]` : ''}${
            data.partB ? `[${colors.cyan(data.partB)}]` : ''
        }${data.partC ? `[${colors.red(data.partC)}]` : ''}${data.partD ? `[${colors.yellow(data.partD)}]` : ''}${
            data.performance ? `[${colors.bgYellow(colors.black(data.performance))}]` : ''
        }: ${data.message}`
    );
}

export function logItemAction(
    logLevel: LogLevel,
    actionType: ActionType,
    itemType: ItemType,
    data: {
        language?: string;
        workflowStep?: string;
        workflow?: string;
        title: string;
        codename?: string;
    }
): void {
    if (logLevel === 'verbose') {
        logDebug({
            type: actionType,
            message: data.title,
            partA: itemType,
            partB: data.codename,
            partC: data.language,
            partD: data.workflow && data.workflowStep ? `${data.workflow}>${data.workflowStep}` : undefined
        });
    }
}
