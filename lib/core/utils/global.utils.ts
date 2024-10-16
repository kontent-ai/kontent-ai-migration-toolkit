import { ITrackingEventData, getTrackingService } from '@kontent-ai-consulting/tools-analytics';
import { isBrowser, isNode, isWebWorker } from 'browser-or-node';
import { format } from 'bytes';
import { getDefaultLogger } from '../logs/loggers.js';
import { EnvContext } from '../models/core.models.js';
import { Logger } from '../models/log.models.js';
import { extractErrorData } from './error.utils.js';

export type Writeable<T> = { -readonly [P in keyof T]: T[P] };

export const isNotUndefined = <T>(item: T | undefined): item is T => item !== undefined;

export function formatBytes(bytes: number): string {
    return format(bytes);
}

export function sleepAsync(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function exitProgram(data: { readonly message: string }): never {
    throw Error(data.message);
}

export function getCurrentEnvironment(): EnvContext {
    if (isNode) {
        return 'node';
    }
    if (isBrowser || isWebWorker) {
        return 'browser';
    }

    throw Error(`Invalid current environment. This library can be used in node.js or in browsers.`);
}

export const defaultZipFilename: string = 'data.zip';

export async function executeWithTrackingAsync<TResult>(data: {
    func: () => Promise<TResult extends void ? void : Readonly<TResult>>;
    event: Readonly<ITrackingEventData>;
    logger?: Logger;
}): Promise<TResult extends void ? void : Readonly<TResult>> {
    const trackingService = getTrackingService();
    const logger = data.logger ?? getDefaultLogger();

    const event = await runTrackingFuncWithErrorHadlingAsync({
        func: async () => {
            return await trackingService.trackEventAsync(data.event);
        },
        logger: logger
    });

    try {
        const result = await data.func();

        if (event) {
            await runTrackingFuncWithErrorHadlingAsync({
                func: async () => {
                    await trackingService.setEventResultAsync({
                        eventId: event.eventId,
                        result: 'success'
                    });
                },
                logger: logger
            });
        }

        return result;
    } catch (error) {
        if (event) {
            await runTrackingFuncWithErrorHadlingAsync({
                func: async () => {
                    await trackingService.setEventResultAsync({
                        eventId: event.eventId,
                        result: 'fail'
                    });
                },
                logger: logger
            });
        }

        throw error;
    }
}

async function runTrackingFuncWithErrorHadlingAsync<T>(data: { func: () => Promise<T>; logger: Logger }): Promise<T | void> {
    try {
        return await data.func();
    } catch (trackingError) {
        data.logger.log({
            message: `Failed to track event. ${extractErrorData(trackingError).message}`,
            type: 'warning'
        });
    }
}
