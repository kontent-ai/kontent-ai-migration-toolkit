import { IManagementClient, ProjectModels, SharedModels } from '@kontent-ai/management-sdk';
import { IRetryStrategyOptions } from '@kontent-ai/core-sdk';
import { yellow } from 'colors';

export const defaultRetryStrategy: IRetryStrategyOptions = {
    addJitter: true,
    canRetryError: (err) => true, // so that timeout errors are retried
    maxAttempts: 3,
    deltaBackoffMs: 1000
};

export async function printProjectInfoToConsoleAsync(client: IManagementClient<any>): Promise<ProjectModels.ProjectInformationModel> {
    const projectInformation = (await client.projectInformation().toPromise()).data;
    console.log(`Project '${yellow(projectInformation.project.name)}'`);
    console.log(`Environment '${yellow(projectInformation.project.environment)}'\n`);

    return projectInformation.project;
}

export function getFilenameWithoutExtension(filename: string): string {
    if (!filename) {
        throw Error(`Invalid filename`);
    }

    if (!filename.includes('.')) {
        return filename;
    }

    return filename.split('.').slice(0, -1).join('.');
}

export function handleError(error: any | SharedModels.ContentManagementBaseKontentError): void {
    let result = error;
    if (error instanceof SharedModels.ContentManagementBaseKontentError) {
        result = {
            Message: `Failed to import data with error: ${error.message}`,
            ErrorCode: error.errorCode,
            RequestId: error.requestId,
            ValidationErrors: `${error.validationErrors.map((m) => m.message).join(', ')}`
        };
    }
    throw result;
}

export function extractAssetIdFromUrl(assetUrl: string): string {
    const url = new URL(assetUrl);

    const splitPaths = url.pathname.split('/');

    if (splitPaths.length < 3) {
        throw Error(`Invalid asset url '${assetUrl}' because asset id could not be determined`);
    }

    return splitPaths[2];
}

export function getHashCode(str: string): number {
    let seed = 1;
    let h1 = 0xdeadbeef ^ seed,
        h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }

    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
