#!/usr/bin/env node
import colors from 'colors';

import { handleError, logErrorAndExit } from '../../core/index.js';
import { getCliConfigAsync } from './utils/cli.utils.js';
import { cliArgs } from './commands.js';
import { exportAsync } from './actions/export.utils.js';
import { importAsync } from './actions/import.utils.js';

const run = async () => {
    const config = await getCliConfigAsync(cliArgs);

    if (config.action === 'export') {
        await exportAsync(config);
    } else if (config.action === 'import') {
        await importAsync(config);
    } else {
        logErrorAndExit({
            message: `Invalid action '${colors.red(config.action)}'`
        });
    }
};

run().catch((err) => {
    handleError(err);
});
