import { HttpService, IRetryStrategyOptions } from '@kontent-ai/core-sdk';
import { OriginalManagementError } from '../models/core.models.js';
import { match } from 'ts-pattern';

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

        return (
            match(errorCode)
                // retry rate exceeded error
                .with(rateExceededErrorCode, () => true)
                // do not retry errors indicating resource does not exist
                .with(notFoundErrorCode, () => false)
                // if error code is set, do not retry the request
                .when(
                    (errorCode) => errorCode >= 0,
                    () => false
                )
                .otherwise(() => true)
        );
    },
    maxAttempts: 3,
    deltaBackoffMs: 1000
};
