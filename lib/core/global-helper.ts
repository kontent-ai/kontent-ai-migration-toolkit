import { IManagementClient, EnvironmentModels, SharedModels } from '@kontent-ai/management-sdk';
import { IRetryStrategyOptions } from '@kontent-ai/core-sdk';
import { format } from 'bytes';
import { logDebug } from './log-helper';

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
    logDebug('info', 'Project', environmentInformation.project.name);
    logDebug('info', 'Environment', environmentInformation.project.environment);

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

export function extractErrorMessage(error: any): string {
    if (error instanceof SharedModels.ContentManagementBaseKontentError) {
        let message: string = `${error.message}`;

        for (const validationError of error.validationErrors) {
            message += ` ${validationError.message}`;
        }
        return message;
    }
    if (error instanceof Error) {
        return error.message;
    }

    return `Unknown error`;
}

export function is404Error(error: any): boolean {
    if (
        error instanceof SharedModels.ContentManagementBaseKontentError &&
        error.originalError?.response?.status === 404
    ) {
        return true;
    }

    return false;
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
