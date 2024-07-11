import chalk from 'chalk';
import { Logger } from '../models/log.models.js';
import { getMigrationManagementClient, managementClientUtils } from './management-client-utils.js';

export async function confirmExportAsync(data: {
    readonly force: boolean;
    readonly environmentId: string;
    readonly apiKey: string;
    readonly logger: Logger;
    readonly dataToExport: {
        readonly itemsCount: number;
    };
}): Promise<void> {
    const environment = await managementClientUtils(
        getMigrationManagementClient({
            environmentId: data.environmentId,
            apiKey: data.apiKey
        }),
        data.logger
    ).getEnvironmentAsync();

    const text: string = `Are you sure to export '${chalk.cyan(
        data.dataToExport.itemsCount
    )}' content ${getItemsPluralText(data.dataToExport.itemsCount)} from ${chalk.yellow(
        environment.name
    )} (${chalk.magenta(environment.environment)})?`;

    await confirmAsync({
        force: data.force,
        logger: data.logger,
        action: 'Export',
        message: text
    });
}

export async function confirmMigrateAsync(data: {
    readonly force: boolean;
    readonly sourceEnvironment: {
        readonly environmentId: string;
        readonly apiKey: string;
    };
    readonly targetEnvironment: {
        readonly environmentId: string;
        readonly apiKey: string;
    };
    readonly logger: Logger;
    readonly dataToMigrate: {
        readonly itemsCount: number;
    };
}): Promise<void> {
    const sourceEnvironment = await managementClientUtils(
        getMigrationManagementClient({
            environmentId: data.sourceEnvironment.environmentId,
            apiKey: data.sourceEnvironment.apiKey
        }),
        data.logger
    ).getEnvironmentAsync();
    const targetEnvironment = await managementClientUtils(
        getMigrationManagementClient({
            environmentId: data.targetEnvironment.environmentId,
            apiKey: data.targetEnvironment.apiKey
        }),
        data.logger
    ).getEnvironmentAsync();

    const text: string = `Are you sure to migrate '${chalk.cyan(data.dataToMigrate.itemsCount)}' ${getItemsPluralText(
        data.dataToMigrate.itemsCount
    )} from ${chalk.yellow(sourceEnvironment.name)} (${chalk.magenta(
        sourceEnvironment.environment
    )}) to environment ${chalk.yellow(targetEnvironment.name)} (${chalk.magenta(targetEnvironment.environment)}) ?`;

    await confirmAsync({
        force: data.force,
        logger: data.logger,
        action: 'Migrate',
        message: text
    });
}

export async function confirmImportAsync(data: {
    readonly force: boolean;
    readonly environmentId: string;
    readonly apiKey: string;
    readonly logger: Logger;
}): Promise<void> {
    const environment = await managementClientUtils(
        getMigrationManagementClient({
            environmentId: data.environmentId,
            apiKey: data.apiKey
        }),
        data.logger
    ).getEnvironmentAsync();

    const text: string = `Are you sure to import data into ${chalk.yellow(environment.name)} (${chalk.magenta(
        environment.environment
    )})?`;

    await confirmAsync({
        force: data.force,
        logger: data.logger,
        action: 'Import',
        message: text
    });
}

async function confirmAsync(data: {
    readonly action: string;
    readonly message: string;
    readonly force: boolean;
    readonly logger: Logger;
}): Promise<void> {
    // Prompts is imported dynamically because it's a node.js only module and would not work if user
    // tried using this library in a browser
    const prompts = await import('prompts');

    if (data.force) {
        data.logger.log({
            type: 'info',
            message: `Skipping confirmation prompt due to the use of 'force' param`
        });
    } else {
        const confirmed = await prompts.default({
            type: 'confirm',
            name: 'confirm',
            message: `${chalk.cyan(data.action)}: ${data.message}`
        });

        if (!confirmed.confirm) {
            throw Error(`Confirmation refused.`);
        }
    }
}

function getItemsPluralText(count: number): string {
    if (count === 1) {
        return 'item';
    }
    return 'items';
}
