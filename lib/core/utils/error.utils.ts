import { SharedModels } from '@kontent-ai/management-sdk';
import chalk from 'chalk';
import { match } from 'ts-pattern';
import { ZodError } from 'zod';
import { ErrorData, OriginalManagementError } from '../models/core.models.js';

export function extractErrorData(error: unknown): ErrorData {
    return match(error)
        .returnType<ErrorData>()
        .when(
            (error) => error instanceof SharedModels.ContentManagementBaseKontentError,
            (error) => {
                const originalError = error.originalError as OriginalManagementError | undefined;

                return {
                    isUnknownError: false,
                    error: error,
                    message: `${error.message} ${error.validationErrors.map((m) => m.message).join(', ')}`,
                    requestUrl: originalError?.response?.config?.url,
                    requestData: originalError?.response?.config?.data
                };
            }
        )
        .when(
            (error) => error instanceof ZodError,
            (error) => {
                return {
                    isUnknownError: false,
                    error: error,
                    message: `Found '${chalk.red(error.issues.length)}' parsing errors: \n${error.issues.reduce<string>(
                        (current, issue, index) => {
                            return (current += `\n${index + 1}. ${chalk.red(issue.message)} (${chalk.yellow('path')}: ${issue.path.join(
                                ','
                            )})`);
                        },
                        ''
                    )}`
                };
            }
        )
        .when(
            (error) => error instanceof Error,
            (error) => {
                return {
                    isUnknownError: false,
                    error: error,
                    message: error.message
                };
            }
        )
        .otherwise((error) => {
            return {
                isUnknownError: true,
                error: error,
                message: `Unknown error`
            };
        });
}

export function is404Error(error: unknown): boolean {
    if (error instanceof SharedModels.ContentManagementBaseKontentError) {
        const originalError = error.originalError as OriginalManagementError | undefined;

        if (originalError?.response?.status === 404) {
            return true;
        }
    }

    return false;
}

export function handleError(error: unknown): void {
    const errorData = extractErrorData(error);

    if (errorData.isUnknownError) {
        console.error(error);
    }

    if (errorData.requestData) {
        console.log(`${chalk.red('Request data')}: ${errorData.requestData}`);
    }

    if (errorData.requestUrl) {
        console.log(`${chalk.red('Request url')}: ${errorData.requestUrl}`);
    }

    console.error(`${chalk.red('Error:')} ${errorData.message}`);
}
