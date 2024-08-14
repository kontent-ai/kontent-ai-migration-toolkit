#!/usr/bin/env node
import chalk from 'chalk';

import { handleError, exitProgram } from '../../core/index.js';
import { exportActionAsync } from './actions/export-action.js';
import { importActionAsync } from './actions/import-action.js';
import { migrateActionAsync } from './actions/migrate-action.js';
import { argumentsFetcherAsync } from './args/args-fetcher.js';
import { cliArgs } from './commands.js';
import { match } from 'ts-pattern';

// Need to register --help commands
cliArgs.registerCommands();

const run = async () => {
    const argsFetcher = await argumentsFetcherAsync();
    const action = argsFetcher.getCliAction();

    return await match(action)
        .with('export', async () => await exportActionAsync(argsFetcher))
        .with('import', async () => await importActionAsync(argsFetcher))
        .with('migrate', async () => await migrateActionAsync(argsFetcher))
        .otherwise(() =>
            exitProgram({
                message: `Invalid action '${chalk.red(action)}'`
            })
        );
};

run().catch((err) => {
    handleError(err);
});
