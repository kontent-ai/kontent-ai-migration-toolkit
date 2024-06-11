import chalk from 'chalk';
import { KontentAiExportRequestItem } from '../export.models.js';

export function throwErrorForItemRequest(itemRequest: KontentAiExportRequestItem, message: string): never {
    throw Error(
        `Export failed for item '${chalk.yellow(itemRequest.itemCodename)}' in language '${chalk.cyan(
            itemRequest.languageCodename
        )}'. Reason: ${message}`
    );
}
