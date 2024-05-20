#!/usr/bin/env node
import colors from 'colors';

import { handleError, logErrorAndExit } from '../../core/index.js';
import { cliArgs } from './commands.js';
import { exportAsync } from './actions/export.utils.js';
import { importAsync } from './actions/import.utils.js';
import { migrateAsync } from './actions/migrate.utils.js';

const run = async () => {
    const action = await cliArgs.getRequiredArgumentValueAsync('action');

    if (action === 'export') {
        await exportAsync(cliArgs);
    } else if (action === 'import') {
        await importAsync(cliArgs);
    } else if (action === 'migrate') {
        await migrateAsync(cliArgs);
    } else {
        logErrorAndExit({
            message: `Invalid action '${colors.red(action)}'`
        });
    }
};

run().catch((err) => {
    handleError(err);
});
