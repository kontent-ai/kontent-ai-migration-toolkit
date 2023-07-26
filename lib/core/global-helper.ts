import { IManagementClient, EnvironmentModels, SharedModels } from '@kontent-ai/management-sdk';
import { IRetryStrategyOptions } from '@kontent-ai/core-sdk';
import { yellow } from 'colors';
import { format } from 'bytes';

const rateExceededErrorCode: number = 10000;

export function formatBytes(bytes: number): string {
    return format(bytes);
}

export const defaultRetryStrategy: IRetryStrategyOptions = {
    addJitter: true,
    canRetryError: (err) => {
        // do not retry failed request from Kontent.ai
        const errorCode = err?.response?.data?.error_code ?? -1;
        if (errorCode >= 0 && errorCode !== rateExceededErrorCode) {
            return false;
        }
        return true;
    },
    maxAttempts: 3,
    deltaBackoffMs: 1000
};

export function getExtension(url: string): string | undefined {
    return url.split('.').pop();
}

export async function printProjectAndEnvironmentInfoToConsoleAsync(
    client: IManagementClient<any>
): Promise<EnvironmentModels.EnvironmentInformationModel> {
    const environmentInformation = (await client.environmentInformation().toPromise()).data;
    console.log(`Project '${yellow(environmentInformation.project.name)}'`);
    console.log(`Environment '${yellow(environmentInformation.project.environment)}'\n`);

    return environmentInformation.project;
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
