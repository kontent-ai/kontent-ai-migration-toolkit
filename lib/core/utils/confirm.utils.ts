import { createManagementClient } from '@kontent-ai/management-sdk';
import chalk from 'chalk';
import { Logger } from '../models/log.models.js';

export async function confirmExportAsync(data: {
    readonly force: boolean;
    readonly environmentId: string;
    readonly apiKey: string;
    readonly logger: Logger;
}): Promise<void> {
    const environment = (
        await createManagementClient({
            apiKey: data.apiKey,
            environmentId: data.environmentId
        })
            .environmentInformation()
            .toPromise()
    ).data.project;

    const text: string = `Are you sure to export data from ${chalk.yellow(environment.name)} -> ${chalk.yellow(
        environment.environment
    )}?`;

    await confirmAsync({
        force: data.force,
        logger: data.logger,
        action: 'Export',
        message: text
    });
}

export async function confirmMigrateAsync(data: {
    force: boolean;
    sourceEnvironment: {
        environmentId: string;
        apiKey: string;
    };
    targetEnvironment: {
        environmentId: string;
        apiKey: string;
    };
    logger: Logger;
}): Promise<void> {
    const sourceEnvironment = (
        await createManagementClient({
            apiKey: data.sourceEnvironment.apiKey,
            environmentId: data.sourceEnvironment.environmentId
        })
            .environmentInformation()
            .toPromise()
    ).data.project;
    const targetEnvironment = (
        await createManagementClient({
            apiKey: data.targetEnvironment.apiKey,
            environmentId: data.targetEnvironment.environmentId
        })
            .environmentInformation()
            .toPromise()
    ).data.project;

    const text: string = `Are you sure to migrate data from ${chalk.yellow(sourceEnvironment.name)} -> ${chalk.yellow(
        sourceEnvironment.environment
    )} to environment ${chalk.yellow(targetEnvironment.name)} -> ${chalk.yellow(targetEnvironment.environment)}?`;

    await confirmAsync({
        force: data.force,
        logger: data.logger,
        action: 'Migrate',
        message: text
    });
}

export async function confirmImportAsync(data: {
    force: boolean;
    environmentId: string;
    apiKey: string;
    logger: Logger;
}): Promise<void> {
    const environment = (
        await createManagementClient({
            apiKey: data.apiKey,
            environmentId: data.environmentId
        })
            .environmentInformation()
            .toPromise()
    ).data.project;

    const text: string = `Are you sure to import data into ${chalk.yellow(environment.name)} -> ${chalk.yellow(
        environment.environment
    )}?`;

    await confirmAsync({
        force: data.force,
        logger: data.logger,
        action: 'Import',
        message: text
    });
}

async function confirmAsync(data: { action: string; message: string; force: boolean; logger: Logger }): Promise<void> {
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
