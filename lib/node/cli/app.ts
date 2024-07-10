#!/usr/bin/env node
import chalk from 'chalk';

import { handleError, exitProgram } from '../../core/index.js';
import { exportActionAsync } from './actions/export-action.js';
import { importActionAsync } from './actions/import-action.js';
import { migrateActionAsync } from './actions/migrate-action.js';
import { argumentsFetcherAsync } from './args/args-fetcher.js';
import { cliArgs } from './commands.js';

// This enabled --help with all commands, options & samples
cliArgs.registerCommands();

const run = async () => {
    const argsFetcher = await argumentsFetcherAsync();
    const action = argsFetcher.getCliAction();

    if (action === 'export') {
        return await exportActionAsync(argsFetcher);
    } else if (action === 'import') {
        return await importActionAsync(argsFetcher);
    } else if (action === 'migrate') {
        return await migrateActionAsync(argsFetcher);
    }

    exitProgram({
        message: `Invalid action '${chalk.red(action)}'`
    });
};

run().catch((err) => {
    handleError(err);
});
