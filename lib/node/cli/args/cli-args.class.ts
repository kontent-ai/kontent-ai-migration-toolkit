import yargs, { Argv } from 'yargs';
import colors from 'colors';
import { logErrorAndExit } from '../../../core/index.js';

export function getCliArgs(): CliArgs {
    const argv = yargs(process.argv.slice(2));

    return new CliArgs(argv);
}

export class CliArgs {
    constructor(private readonly argv: Argv) {}

    withExample(config: { example: string; command: string }): CliArgs {
        this.argv.example(config.command, config.example);
        return this;
    }

    withCommand(config: {
        name: string;
        alias?: string;
        description?: string;
        type?: 'boolean' | 'number' | 'string' | 'array';
    }): CliArgs {
        this.argv.option(config.name, {
            alias: config.alias,
            description: config.description,
            type: config.type
        });

        return this;
    }

    async getOptionalArgumentValueAsync(argName: string): Promise<string | undefined> {
        return (await this.resolveArgsAsync())[argName]?.toString();
    }

    async getRequiredArgumentValueAsync(argName: string): Promise<string> {
        const value = await this.getOptionalArgumentValueAsync(argName);

        if (!value) {
            logErrorAndExit({
                message: `Missing '${colors.red(argName)}' argument value`
            });
        }

        return value;
    }

    async getBooleanArgumentValueAsync(argName: string, defaultValue: boolean): Promise<boolean> {
        const value = await this.getOptionalArgumentValueAsync(argName);

        if (!value) {
            return defaultValue;
        }

        return value.toLowerCase() === 'true'.toLowerCase();
    }

    private async resolveArgsAsync(): Promise<any> {
        const resolvedArgv = await this.argv.argv;
        return resolvedArgv;
    }
}
