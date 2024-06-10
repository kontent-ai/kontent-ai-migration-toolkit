import chalk from 'chalk';
import { ILogData, ILogSpinner, getLogDataMessage } from '../utils/log.utils.js';

export class DefaultSpinner implements ILogSpinner {
    private oraInstance:
        | {
              start: (text?: string) => unknown;
              stop: () => unknown;
              text: string | undefined;
          }
        | undefined;

    private index: number = 0;
    private readonly originalWarn = global.console.warn;

    constructor(private readonly totalCount: number) {}

    nextItem(): void {
        this.index += 1;
    }

    async startAsync(): Promise<void> {
        if (!this.oraInstance) {
            // Ora is imported dynamically because it's a node.js only module and would not work if user
            // tried using this library in a browser
            const ora = await import('ora');
            const oraInstance = ora.default();
            this.oraInstance = oraInstance;
            this.oraInstance.start();

            // patch global console to prevent disrupting ora instance
            // this often happens when JS SDK logs console.warn for
            // retried requests. Patching this ensures the flow is uninterrupted
            global.console.warn = (m) => {
                oraInstance.text = m?.toString();
            };
        }
    }

    async stopAsync(): Promise<void> {
        if (this.oraInstance) {
            this.oraInstance.stop();

            // restore original warn
            global.console.warn = this.originalWarn;
        }
    }

    async logAsync(data: ILogData): Promise<void> {
        if (this.oraInstance) {
            this.oraInstance.text = `${this.getCountText()}: ${getLogDataMessage({
                message: data.message,
                type: data.type
            })}`;
        }
    }

    private getCountText(): string {
        return `${chalk.cyan(`${this.index}/${this.totalCount}`)}`;
    }
}
