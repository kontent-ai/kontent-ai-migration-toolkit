import colors from 'colors';

import { ActionType, ItemType } from './core.models.js';

export type DebugType = 'error' | 'warning' | 'info' | ActionType;

export function logProcessingDebug(data: {
    index: number;
    totalCount: number;
    itemType: ItemType;
    title: string;
}): void {
    console.log(
        `[${colors.bgYellow(colors.black(`${data.index}/${data.totalCount}`))}][${colors.yellow(
            data.itemType
        )}]: Starts processing ${data.title}`
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
        typeColor = colors.blue;
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
