import chalk, { ChalkInstance } from 'chalk';
import { match, P } from 'ts-pattern';
import { Logger, LogSpinnerMessage } from '../models/log.models.js';
import { getCurrentEnvironment } from '../utils/global.utils.js';

const originalWarn = console.warn;

export function getDefaultLogger(): Logger {
    return match(getCurrentEnvironment())
        .with('node', () => defaultNodeLogger)
        .with('browser', () => defaultBrowserLogger)
        .exhaustive();
}

const defaultNodeLogger: Logger = {
    log: (data) => console.log(getLogDataMessage(data)),
    logWithSpinnerAsync: async (func) => {
        const ora = await import('ora');

        return await ora.oraPromise(async (spinner) => {
            // patch global console to prevent disrupting ora instance
            // this often happens when JS SDK logs console.warn for
            // retried requests. Patching this ensures the flow is uninterrupted
            global.console.warn = (m) => {
                if (m) {
                    spinner.text = (m as unknown)?.toString() ?? 'Invalid warn value';
                }
            };

            const result = await func((data) => {
                // remember last used prefix. This is useful as we don't have to pass prefix to every single function
                // calling the spinner
                if (data.prefix) {
                    spinner.prefixText = data.prefix ?? '';
                }
                spinner.text = getLogDataMessage(data);
            });

            // restore original warn
            global.console.warn = originalWarn;

            return result;
        }, {});
    }
};

const defaultBrowserLogger: Logger = {
    log: (data) => console.log(getLogDataMessage(data)),
    logWithSpinnerAsync: async (func) => {
        return await func((data) => {
            const prefix = data.prefix ? `${data.prefix}: ` : '';
            console.log(`${prefix}${getLogDataMessage(data)}`);
        });
    }
};

function getLogDataMessage(data: LogSpinnerMessage): string {
    const color = match(data.type)
        .returnType<ChalkInstance>()
        .with('info', () => chalk.cyan)
        .with(P.union('error', 'errorData', 'warning', 'cancel'), () => chalk.red)
        .with('completed', () => chalk.green)
        .with('skip', () => chalk.gray)
        .otherwise(() => chalk.yellow);

    return `${color(data.type)}: ${data.message}`;
}
