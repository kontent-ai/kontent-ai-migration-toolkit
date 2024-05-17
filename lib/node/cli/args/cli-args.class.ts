import yargs, { Argv } from 'yargs';

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
        type?: 'boolean' | 'number' | 'string' | 'array'
    }): CliArgs {
        this.argv.option(config.name, {
            alias: config.alias,
            description: config.description,
            type: config.type
        });

        return this;
    }

    async resolveArgsAsync(): Promise<any> {
        const resolvedArgv = await this.argv.argv;
        return resolvedArgv;
    }
}
