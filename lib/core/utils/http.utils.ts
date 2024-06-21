import { HttpService, IRetryStrategyOptions } from '@kontent-ai/core-sdk';
import { OriginalManagementError } from '../models/core.models.js';

const rateExceededErrorCode: number = 10000;
const notFoundErrorCode: number = 10000;

export const defaultHttpService: Readonly<HttpService> = new HttpService({
    logErrorsToConsole: false
});

export const defaultRetryStrategy: Readonly<IRetryStrategyOptions> = {
    addJitter: true,
    canRetryError: (err) => {
        const originalError = err as OriginalManagementError | undefined;
        const errorCode: number = originalError?.response?.data?.error_code ?? -1;

        if (errorCode === rateExceededErrorCode) {
            // retry rate exceeded error
            return true;
        }

        if (errorCode === notFoundErrorCode) {
            // do not retry errors indicating resource does not exist
            return false;
        }

        if (errorCode >= 0) {
            // otherwise if error code is set, do not retry the request
            return false;
        }
        return true;
    },
    maxAttempts: 3,
    deltaBackoffMs: 1000
};
