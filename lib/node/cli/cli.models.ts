import { ExportAdapter, CliAction } from '../../core/index.js';
import { ProcessingFormat } from '../../zip/zip.models.js';

export interface ICliFileConfig {
    adapter?: ExportAdapter;
    environmentId?: string;
    managementApiKey?: string;
    format: ProcessingFormat;
    language?: string;
    items?: string[];
    skipFailedItems: boolean;
    action: CliAction;
    itemsFilename?: string;
    assetsFilename?: string;
    baseUrl?: string;
    force: boolean;
}

export type Args = { [key: string]: string | unknown };

