import { SharedModels } from '@kontent-ai/management-sdk';
import colors from 'colors';
import { IErrorData } from '../models/core.models.js';

export function extractErrorData(error: any): IErrorData {
    let isUnknownError: boolean = true;
    let message: string = `Unknown error`;
    let requestUrl: string | undefined = undefined;
    let requestData: string | undefined = undefined;

    if (error instanceof SharedModels.ContentManagementBaseKontentError) {
        isUnknownError = false;
        message = `${error.message}`;
        requestUrl = error.originalError?.response?.config.url;
        requestData = error.originalError?.response?.config.data;

        for (const validationError of error.validationErrors) {
            message += ` ${validationError.message}`;
        }
    } else if (error instanceof Error) {
        isUnknownError = false;
        message = error.message;
    }

    return {
        message: message,
        requestData: requestData,
        requestUrl: requestUrl,
        error: error,
        isUnknownError: isUnknownError
    };
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

export function handleError(error: any): void {
    const errorData = extractErrorData(error);

    if (errorData.isUnknownError) {
        console.error(error);
    }

    if (errorData.requestData) {
        console.log(`${colors.red('Request data')}: ${errorData.requestData}`);
    }

    if (errorData.requestUrl) {
        console.log(`${colors.red('Request url')}: ${errorData.requestUrl}`);
    }

    console.error(`${colors.red('Error:')} ${errorData.message}`);
}
