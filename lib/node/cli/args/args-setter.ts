import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { CliArgumentsSetter, Command, CommandOption } from '../cli.models.js';

export function argumentsSetter(): CliArgumentsSetter {
    const argv = yargs(hideBin(process.argv));

    return {
        withCommand(command: Command): CliArgumentsSetter {
            argv.command(command.name, command.description, (yargs) => {
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
        },
        withOption(option: CommandOption): CliArgumentsSetter {
            argv.option(option.name, {
                alias: option.alias,
                description: option.description,
                type: option.type,
                demandOption: option.isRequired
            });

            return this;
        }
    };
}
