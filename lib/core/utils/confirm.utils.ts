import { createManagementClient } from '@kontent-ai/management-sdk';
import chalk from 'chalk';
import prompts from 'prompts';
import { exitProcess } from './global.utils.js';
import { Log } from './log.utils.js';

export async function confirmExportAsync(data: {
    force: boolean;
    environmentId: string;
    apiKey: string;
    log: Log;
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
        log: data.log,
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
    log: Log;
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
        log: data.log,
        action: 'Migrate',
        message: text
    });
}

export async function confirmImportAsync(data: {
    force: boolean;
    environmentId: string;
    apiKey: string;
    log: Log;
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
        log: data.log,
        action: 'Import',
        message: text
    });
}

async function confirmAsync(data: { action: string; message: string; force: boolean; log: Log }): Promise<void> {
    if (data.force) {
        data.log.console({
            type: 'info',
            message: `Skipping confirmation prompt due to the use of 'force' param`
        });
    } else {
        const confirmed = await prompts({
            type: 'confirm',
            name: 'confirm',
            message: `${chalk.cyan(data.action)}: ${data.message}`
        });

        if (!confirmed.confirm) {
            data.log.console({
                type: 'cancel',
                message: `Confirmation refused. Exiting process.`
            });
            exitProcess();
        }
    }
}
