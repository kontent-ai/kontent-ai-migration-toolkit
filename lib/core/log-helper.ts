import colors from 'colors';

import { ActionType, ItemType } from './core.models.js';

export type DebugType = 'error' | 'warning' | 'info' | ActionType;

export function logErrorAndExit(data: { message: string }): never {
    logDebug({
        type: 'error',
        message: data.message
    });
    process.exit(1);
}

export function logProcessingDebug(data: {
    index: number;
    totalCount: number;
    itemType: ItemType;
    title: string;
    partA?: string;
}): void {
    console.log(
        `[${colors.green(`${data.index}/${data.totalCount}`)}][${colors.yellow(data.itemType)}]${
            data.partA ? `[${colors.cyan(data.partA)}]` : ''
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

    if (data.type === 'error') {
        typeColor = colors.red;
    } else if (data.type === 'info') {
        typeColor = colors.cyan;
    } else if (data.type === 'warning') {
        typeColor = colors.red;
    }

    console.log(
        `[${typeColor(data.type)}]${data.partA ? `[${colors.yellow(data.partA)}]` : ''}${
            data.partB ? `[${colors.cyan(data.partB)}]` : ''
        }${data.partC ? `[${colors.red(data.partC)}]` : ''}${data.partD ? `[${colors.magenta(data.partD)}]` : ''}${
            data.performance ? `[${colors.bgYellow(colors.black(data.performance))}]` : ''
        }: ${data.message}`
    );
}

export function logItemAction(
    actionType: ActionType,
    itemType: ItemType,
    data: {
        language?: string;
        workflowStep?: string;
        title: string;
        codename?: string;
    }
): void {
    logDebug({
        type: actionType,
        message: data.title,
        partA: itemType,
        partB: data.codename,
        partC: data.language,
        partD: data.workflowStep
    });
}
