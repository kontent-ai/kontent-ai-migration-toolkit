import { readFileSync } from 'fs';
import { CliAction, logErrorAndExit } from '../../../core/index.js';
import { Args, ICliFileConfig } from '../cli.models.js';
import colors from 'colors';
import { CliArgs } from '../args/cli-args.class.js';

export async function getCliConfigAsync(cliArgs: CliArgs): Promise<ICliFileConfig> {
    let resolvedArgs: Args = await cliArgs.resolveArgsAsync();
    const configFilename: string | undefined = getOptionalArgumentValue(resolvedArgs, 'config');

    if (configFilename) {
        // get config from file
        const configFile = readFileSync(`./${configFilename}`);
        resolvedArgs = JSON.parse(configFile.toString());
    }

    const action: CliAction = getRequiredArgumentValue(resolvedArgs, 'action') as CliAction;

    const config: ICliFileConfig = {
        action: action,
        managementApiKey: getOptionalArgumentValue(resolvedArgs, 'managementApiKey'),
        environmentId: getRequiredArgumentValue(resolvedArgs, 'environmentId'),
        itemsFilename: getOptionalArgumentValue(resolvedArgs, 'itemsFilename'),
        assetsFilename: getOptionalArgumentValue(resolvedArgs, 'assetsFilename'),
        baseUrl: getOptionalArgumentValue(resolvedArgs, 'baseUrl'),
        items:
            getOptionalArgumentValue(resolvedArgs, 'items')
                ?.split(',')
                .map((m) => m.trim()) ?? [],
        skipFailedItems: getBooleanArgumentvalue(resolvedArgs, 'skipFailedItems', false),
        force: getBooleanArgumentvalue(resolvedArgs, 'force', false),
        language: getOptionalArgumentValue(resolvedArgs, 'language')
    };

    return config;
}

export const getDefaultExportFilename = (type: 'items' | 'assets') => {
    return `${type}-export.zip`;
};

function getOptionalArgumentValue(args: Args, argName: string): string | undefined {
    return args[argName]?.toString();
}

function getRequiredArgumentValue(args: Args, argName: string): string {
    const value = getOptionalArgumentValue(args, argName);

    if (!value) {
        logErrorAndExit({
            message: `Missing '${colors.red(argName)}' argument value`
        });
    }

    return value;
}

function getBooleanArgumentvalue(args: Args, argName: string, defaultValue: boolean): boolean {
    const value = getOptionalArgumentValue(args, argName);

    if (!value) {
        return defaultValue;
    }

    return value.toLowerCase() === 'true'.toLowerCase();
}
