import { format } from 'bytes';
import { ITrackingEventData, getTrackingService } from '@kontent-ai-consulting/tools-analytics';
import { isBrowser, isNode, isWebWorker } from 'browser-or-node';
import { EnvContext } from '../models/core.models.js';
import { MigrationElementValue, MigrationReference } from '../models/migration.models.js';

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

export function parseAsMigrationReferencesArray(value: MigrationElementValue): readonly MigrationReference[] {
    if (!value) {
        return [];
    }
    if (Array.isArray(value)) {
        return value;
    }
    throw Error(`Value is not an array`);
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

export function getDefaultZipFilename(): string {
    return `data.zip`;
}

export async function executeWithTrackingAsync<TResult>(data: {
    func: () => Promise<TResult extends void ? void : Readonly<TResult>>;
    event: Readonly<ITrackingEventData>;
}): Promise<TResult extends void ? void : Readonly<TResult>> {
    const trackingService = getTrackingService();
    const event = await trackingService.trackEventAsync(data.event);

    try {
        const result = await data.func();

        await trackingService.setEventResultAsync({
            eventId: event.eventId,
            result: 'success'
        });

        return result;
    } catch (error) {
        await trackingService.setEventResultAsync({
            eventId: event.eventId,
            result: 'fail'
        });

        throw error;
    }
}

export async function mapAsync<Input, Result>(
    array: readonly Input[],
    callbackAsync: (item: Readonly<Input>, index: number, array: readonly Input[]) => Promise<Readonly<Result>>
): Promise<Readonly<Result[]>> {
    const results: Result[] = [];
    for (let i = 0; i < array.length; i++) {
        results.push(await callbackAsync(array[i], i, array));
    }
    return results;
}
