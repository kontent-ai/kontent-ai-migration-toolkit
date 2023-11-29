import { green, yellow, cyan, Color, red, blue, bgYellow, black } from 'colors';
import { ActionType, ItemType } from './core.models';

export type DebugType = 'error' | 'warning' | 'info' | ActionType;

export function logProcessingDebug(data: {
    index: number;
    totalCount: number;
    itemType: ItemType;
    title: string;
}): void {
    console.log(
        `[${bgYellow(black(`${data.index}/${data.totalCount}`))}][${yellow(data.itemType)}]: Starts processing ${data.title}`
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
    let typeColor: Color = green;

    if (data.type === 'error') {
        typeColor = red;
    } else if (data.type === 'info') {
        typeColor = blue;
    } else if (data.type === 'warning') {
        typeColor = red;
    }

    console.log(
        `[${typeColor(data.type)}]${data.partA ? `[${yellow(data.partA)}]` : ''}${
            data.partB ? `[${cyan(data.partB)}]` : ''
        }${data.partC ? `[${red(data.partC)}]` : ''}${data.partD ? `[${cyan(data.partD)}]` : ''}${
            data.performance ? `[${bgYellow(black(data.performance))}]` : ''
        }: ${data.message}`
    );
}
