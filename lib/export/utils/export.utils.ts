import colors from 'colors';

import { IKontentAiExportRequestItem } from '../export.models.js';

export function throwErrorForItemRequest(itemRequest: IKontentAiExportRequestItem, message: string): never {
    throw Error(
        `Export failed for item '${colors.yellow(itemRequest.itemCodename)}' in language '${colors.cyan(
            itemRequest.languageCodename
        )}'. Reason: ${message}`
    );
}
