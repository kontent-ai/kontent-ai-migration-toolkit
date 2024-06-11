import yargs, { Argv } from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import { CliAction, logErrorAndExit } from '../../../core/index.js';
import { Command, CommandOption } from '../cli.models.js';

export function getCliArgs(): CliArgs {
    const argv = yargs(hideBin(process.argv));
    return new CliArgs(argv);
}

export class CliArgs {
    constructor(private readonly argv: Argv) {}

    withCommand(command: Command): CliArgs {
        this.argv.command(command.name, command.description, (yargs) => {
            for (const example of command.examples) {
                yargs.example(command.name, example);
            }

            for (const option of command.options) {
                yargs.positional(option.name, {
                    alias: option.alias,
                    describe: option.description,
                    type: option.type,
                    demandOption: option.isRequired
                });
            }
        });

        return this;
    }

    withOption(option: CommandOption): CliArgs {
        this.argv.option(option.name, {
            alias: option.alias,
            description: option.description,
            type: option.type,
            demandOption: option.isRequired
        });

        return this;
    }

    async getCliActionAsync(): Promise<CliAction> {
        const resolvedArgv = await this.argv.argv;
        const command = resolvedArgv._?.[0]?.toString()?.toLowerCase();

        if (command === <CliAction>'export') {
            return 'export';
        }
        if (command === <CliAction>'import') {
            return 'import';
        }
        if (command === <CliAction>'migrate') {
            return 'migrate';
        }

        throw Error(`Unsupported command '${chalk.yellow(command)}'`);
    }

    async getOptionalArgumentValueAsync(argName: string): Promise<string | undefined> {
        return (await this.resolveArgsAsync())[argName]?.toString();
    }

    async getRequiredArgumentValueAsync(argName: string): Promise<string> {
        const value = await this.getOptionalArgumentValueAsync(argName);

        if (!value) {
            logErrorAndExit({
                message: `Missing '${chalk.yellow(argName)}' argument value`
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
