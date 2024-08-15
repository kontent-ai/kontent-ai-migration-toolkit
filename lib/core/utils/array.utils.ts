import { MigrationElementValue, MigrationReference } from '../models/migration.models.js';

export function parseAsMigrationReferencesArray(value: MigrationElementValue): readonly MigrationReference[] {
    if (!value) {
        return [];
    }
    if (Array.isArray(value)) {
        return value;
    }
    throw Error(`Value is not an array`);
}

export function findRequired<T>(array: readonly T[], predicate: (item: T, index: number) => boolean, errorMessage: string): T;
export function findRequired<T>(array: readonly T[], predicate: (item: T, index: number) => boolean, errorMessage: () => never): T;
export function findRequired<T>(
    array: readonly T[],
    predicate: (item: T, index: number) => boolean,
    errorMessage: string | (() => never)
): T {
    const item = array.find(predicate);

    if (item) {
        return item;
    }

    if (typeof errorMessage === 'string' || errorMessage instanceof String) {
        throw Error(errorMessage.toString());
    }
    return errorMessage();
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
