import { green, yellow, cyan, Color, red, blue } from 'colors';
import { ActionType } from './core.models';

export type DebugType = 'error' | 'warning' | 'info' | ActionType;

export function logDebug(action: DebugType, message: string, info1?: string, info2?: string): void {
    let typeColor: Color = green;

    if (action === 'error') {
        typeColor = red;
    } else if (action === 'warning') {
        typeColor = blue;
    }
    console.log(
        `[${typeColor(action)}]${info1 ? `[${yellow(info1)}]` : ''}${info2 ? `[${cyan(info2)}]` : ''}: ${message}`
    );
}
