import { readFileSync } from 'fs';
import { CliAction, ExportAdapter, logErrorAndExit } from '../../../core/index.js';
import {
    AssetCsvProcessorService,
    AssetJsonProcessorService,
    ItemCsvProcessorService,
    ItemJsonProcessorService
} from '../../../file/index.js';
import { ProcessingFormat, IAssetFormatService, IItemFormatService } from '../../../zip/zip.models.js';
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
    const format: string | undefined = getOptionalArgumentValue(resolvedArgs, 'format');
    const adapter: string | undefined = getOptionalArgumentValue(resolvedArgs, 'adapter');

    let mappedFormat: ProcessingFormat = 'csv';
    let mappedAdapter: ExportAdapter = 'kontentAi';

    if (format?.toLowerCase() === <ProcessingFormat>'csv'.toLowerCase()) {
        mappedFormat = 'csv';
    } else if (format?.toLowerCase() === <ProcessingFormat>'json'.toLowerCase()) {
        mappedFormat = 'json';
    } else {
        if (action === 'export') {
            logErrorAndExit({
                message: `Unsupported export format '${colors.red(format ?? '')}'`
            });
        }
    }

    if (adapter?.toLowerCase() === <ExportAdapter>'kontentAi'.toLowerCase()) {
        mappedAdapter = 'kontentAi';
    } else {
        if (action === 'export') {
            logErrorAndExit({
                message: `Unsupported adapter '${adapter}'`
            });
        }
    }

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
        adapter: mappedAdapter,
        format: mappedFormat,
        language: getOptionalArgumentValue(resolvedArgs, 'language')
    };

    return config;
}

export const getDefaultExportFilename = (type: 'items' | 'assets') => {
    return `${type}-export.zip`;
};

export function getAssetFormatService(format: ProcessingFormat | undefined): IAssetFormatService {
    if (format === 'csv') {
        return new AssetCsvProcessorService();
    }

    if (format === 'json') {
        return new AssetJsonProcessorService();
    }

    logErrorAndExit({
        message: `Unsupported format '${colors.red(format ?? '')}' for assets export`
    });
}

export function getItemFormatService(format: ProcessingFormat | undefined): IItemFormatService {
    if (format === 'csv') {
        return new ItemCsvProcessorService();
    }

    if (format === 'json') {
        return new ItemJsonProcessorService();
    }

    logErrorAndExit({
        message: `Unsupported format '${colors.red(format ?? '')}' for items export`
    });
}

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
