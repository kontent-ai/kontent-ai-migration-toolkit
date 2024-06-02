import chalk from 'chalk';
import { IKontentAiExportRequestItem } from '../export.models.js';

export function throwErrorForItemRequest(itemRequest: IKontentAiExportRequestItem, message: string): never {
    throw Error(
        `Export failed for item '${chalk.yellow(itemRequest.itemCodename)}' in language '${chalk.cyan(
            itemRequest.languageCodename
        )}'. Reason: ${message}`
    );
}
