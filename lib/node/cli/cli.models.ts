import { CliAction } from '../../core/index.js';

export interface ICliFileConfig {
    environmentId?: string;
    apiKey?: string;
    language?: string;
    items?: string[];
    skipFailedItems: boolean;
    action: CliAction;
    itemsFilename?: string;
    assetsFilename?: string;
    baseUrl?: string;
    force: boolean;
}

export interface ICommand {
    name: string;
    description: string;
    options: ICommandOption[];
    examples: string[];
}

export interface ICommandOption {
    name: string;
    isRequired: boolean;
    alias?: string;
    description?: string;
    type?: 'boolean' | 'number' | 'string';
}

export type Args = { [key: string]: string | unknown };
