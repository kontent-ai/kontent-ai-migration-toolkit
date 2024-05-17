import { HttpService, IRetryStrategyOptions } from '@kontent-ai/core-sdk';

const rateExceededErrorCode: number = 10000;

export const defaultHttpService: HttpService = new HttpService({
    logErrorsToConsole: false
});

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
