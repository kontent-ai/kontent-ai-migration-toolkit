#!/usr/bin/env node
import colors from 'colors';

import { handleError, logErrorAndExit } from '../../core/index.js';
import { cliArgs } from './commands.js';
import { exportActionAsync } from './actions/export-action.js';
import { importActionAsync } from './actions/import-action.js';
import { migrateActionAsync } from './actions/migrate-action.js';

const run = async () => {
    const action = await cliArgs.getCliActionAsync();

    if (action === 'export') {
        await exportActionAsync(cliArgs);
    } else if (action === 'import') {
        await importActionAsync(cliArgs);
    } else if (action === 'migrate') {
        await migrateActionAsync(cliArgs);
    } else {
        logErrorAndExit({
            message: `Invalid action '${colors.red(action)}'`
        });
    }
};

run().catch((err) => {
    handleError(err);
});
