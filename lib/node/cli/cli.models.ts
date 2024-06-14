import { CliAction } from '../../core/index.js';

export interface CliFileConfig {
    readonly environmentId?: string;
    readonly apiKey?: string;
    readonly language?: string;
    readonly items?: string[];
    readonly skipFailedItems: boolean;
    readonly action: CliAction;
    readonly itemsFilename?: string;
    readonly assetsFilename?: string;
    readonly baseUrl?: string;
    readonly force: boolean;
}

export interface Command {
    readonly name: string;
    readonly description: string;
    readonly options: CommandOption[];
    readonly examples: string[];
}

export interface CommandOption {
    readonly name: string;
    readonly isRequired: boolean;
    readonly alias?: string;
    readonly description?: string;
    readonly type?: 'boolean' | 'number' | 'string';
}
