import { CliAction } from '../../core/index.js';

export interface CliFileConfig {
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

export interface Command {
    name: string;
    description: string;
    options: CommandOption[];
    examples: string[];
}

export interface CommandOption {
    name: string;
    isRequired: boolean;
    alias?: string;
    description?: string;
    type?: 'boolean' | 'number' | 'string';
}

export type Args = { [key: string]: string | unknown };
