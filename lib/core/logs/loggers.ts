import { EnvContext } from '../models/core.models.js';
import { getCurrentEnvironment } from '../utils/global.utils.js';
import { Logger, getLogDataMessage } from '../utils/log.utils.js';

const originalWarn = console.warn;

export function getDefaultLogger(context?: EnvContext): Logger {
    if (!context) {
        // automatically determine the env
        const currentEnv = getCurrentEnvironment();

        if (currentEnv === 'node') {
            return defaultNodeLogger;
        }
        if (currentEnv === 'browser') {
            return defaultBrowserLogger;
        }
    }
    if (context === 'node') {
        return defaultNodeLogger;
    }
    if (context === 'browser') {
        return defaultBrowserLogger;
    }
    throw Error(`Invalid environment '${context}'`);
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
                spinner.text = m?.toString();
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
