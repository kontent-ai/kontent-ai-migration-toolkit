import { HttpService, IRetryStrategyOptions } from '@kontent-ai/core-sdk';

const rateExceededErrorCode: number = 10000;

export const defaultHttpService: HttpService = new HttpService({
    logErrorsToConsole: false
});

export const defaultRetryStrategy: IRetryStrategyOptions = {
    addJitter: true,
    canRetryError: (err) => {
        const errorCode = err?.response?.data?.error_code ?? -1;

        if (errorCode === rateExceededErrorCode) {
            // retry rate exceeded error
            return true;
        }

        // otherwise if error code is set, do not retry the request
        if (errorCode >= 0) {
            return false;
        }
        return true;
    },
    maxAttempts: 3,
    deltaBackoffMs: 1000
};
