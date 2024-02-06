import { SharedModels } from '@kontent-ai/management-sdk';
import { IRetryStrategyOptions } from '@kontent-ai/core-sdk';
import { format } from 'bytes';
import { logDebug, logErrorAndExit, logProcessingDebug } from './log-helper.js';
import { HttpService } from '@kontent-ai/core-sdk';
import { IChunk, IErrorData, IProcessInChunksItemInfo } from './core.models.js';

const rateExceededErrorCode: number = 10000;

export const defaultHttpService: HttpService = new HttpService({
    logErrorsToConsole: false
});

export function formatBytes(bytes: number): string {
    return format(bytes);
}

export function sleepAsync(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

export function extractErrorData(error: any): IErrorData {
    let message: string = `Unknown error`;
    let requestUrl: string | undefined = undefined;
    let requestData: string | undefined = undefined;

    if (error instanceof SharedModels.ContentManagementBaseKontentError) {
        message = `${error.message}`;
        requestUrl = error.originalError?.response?.config.url;
        requestData = error.originalError?.response?.config.data;

        for (const validationError of error.validationErrors) {
            message += ` ${validationError.message}`;
        }
    }
    if (error instanceof Error) {
        message = error.message;
    }

    return {
        message: message,
        requestData: requestData,
        requestUrl: requestUrl
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

    if (errorData.requestUrl) {
        logDebug({
            type: 'errorData',
            message: errorData.requestUrl,
            partA: 'Request Url'
        });
    }

    if (errorData.requestData) {
        logDebug({
            type: 'errorData',
            message: errorData.requestData,
            partA: 'Request Data'
        });
    }

    logErrorAndExit({
        message: errorData.message
    });
}

export function extractAssetIdFromUrl(assetUrl: string): string {
    const url = new URL(assetUrl);
    const splitPaths = url.pathname.split('/');

    if (splitPaths.length < 3) {
        logErrorAndExit({
            message: `Invalid asset url '${assetUrl}' because asset id could not be determined`
        });
    }

    return splitPaths[2];
}

export function extractFilenameFromUrl(assetUrl: string): string {
    const url = new URL(assetUrl);
    const splitPaths = url.pathname.split('/');
    return splitPaths[splitPaths.length - 1];
}

export async function processInChunksAsync<TInputItem, TOutputItem>(data: {
    items: TInputItem[];
    chunkSize: number;
    processFunc: (item: TInputItem) => Promise<TOutputItem>;
    itemInfo?: (item: TInputItem) => IProcessInChunksItemInfo;
}): Promise<TOutputItem[]> {
    const chunks = splitArrayIntoChunks<TInputItem>(data.items, data.chunkSize);
    const outputItems: TOutputItem[] = [];
    let processingIndex: number = 0;

    for (const chunk of chunks) {
        await Promise.all(
            chunk.items.map((item) => {
                processingIndex++;

                if (data.itemInfo) {
                    const itemInfo = data.itemInfo(item);
                    logProcessingDebug({
                        index: processingIndex,
                        totalCount: data.items.length,
                        itemType: itemInfo.itemType,
                        title: itemInfo.title,
                        partA: itemInfo.partA
                    });
                }
                return data.processFunc(item).then((output) => {
                    outputItems.push(output);
                });
            })
        );
    }

    return outputItems;
}

function splitArrayIntoChunks<T>(items: T[], chunkSize: number): IChunk<T>[] {
    if (!items.length) {
        return [];
    }

    const chunks: IChunk<T>[] = [];

    for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        chunks.push({
            index: i,
            items: chunk
        });
    }

    return chunks;
}
