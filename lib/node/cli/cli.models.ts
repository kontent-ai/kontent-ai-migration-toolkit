import { CliAction } from '../../core/index.js';

export interface ICliFileConfig {
    environmentId?: string;
    managementApiKey?: string;
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
