#!/usr/bin/env node
import chalk from 'chalk';

import { handleError, exitProgram } from '../../core/index.js';
import { cliArgs } from './commands.js';
import { exportActionAsync } from './actions/export-action.js';
import { importActionAsync } from './actions/import-action.js';
import { migrateActionAsync } from './actions/migrate-action.js';

const run = async () => {
    const action = await cliArgs.getCliActionAsync();

    if (action === 'export') {
        return await exportActionAsync(cliArgs);
    } else if (action === 'import') {
        return await importActionAsync(cliArgs);
    } else if (action === 'migrate') {
        return await migrateActionAsync(cliArgs);
    }

    exitProgram({
        message: `Invalid action '${chalk.red(action)}'`
    });
};

run().catch((err) => {
    handleError(err);
});
