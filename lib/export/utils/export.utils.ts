import chalk from 'chalk';
import { SourceExportItem } from '../export.models.js';

export function throwErrorForItemRequest(itemRequest: SourceExportItem, message: string): never {
    throw Error(
        `Export failed for item '${chalk.yellow(itemRequest.itemCodename)}' in language '${chalk.cyan(
            itemRequest.languageCodename
        )}'. Reason: ${message}`
    );
}
