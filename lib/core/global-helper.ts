import { AssetModels, ManagementClient, SharedModels } from '@kontent-ai/management-sdk';
import { IRetryStrategyOptions } from '@kontent-ai/core-sdk';
import { format } from 'bytes';
import colors from 'colors';
import { Log, withDefaultLogAsync } from './log-helper.js';
import { HttpService } from '@kontent-ai/core-sdk';
import {
    AssetsFormatConfig,
    IChunk,
    IErrorData,
    IProcessInChunksItemInfo,
    ItemType,
    ItemsFormatConfig
} from './core.models.js';
import { ITrackingEventData, getTrackingService } from '@kontent-ai-consulting/tools-analytics';
import prompts from 'prompts';
import { DeliveryError } from '@kontent-ai/delivery-sdk';
import {
    AssetCsvProcessorService,
    AssetJsonProcessorService,
    IAssetFormatService,
    IItemFormatService,
    ItemCsvProcessorService,
    ItemJsonProcessorService
} from '../file-processor/index.js';

const rateExceededErrorCode: number = 10000;

export const defaultHttpService: HttpService = new HttpService({
    logErrorsToConsole: false
});

export function exitProcess(): never {
    process.exit(1);
}

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
    } else if (error instanceof DeliveryError) {
        isUnknownError = false;
        message = error.message;
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

export function getAssetZipFilename(asset: AssetModels.Asset): string {
    return `${asset.id}.${getExtension(asset.url)}`;
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

export function getAssetUrlPath(url: string): string {
    return new URL(url).pathname;
}

export function extractFilenameFromUrl(assetUrl: string): string {
    const url = new URL(assetUrl);
    const splitPaths = url.pathname.split('/');
    return splitPaths[splitPaths.length - 1];
}

export function getItemExternalIdForCodename(codename: string): string {
    return `content_item_${codename}`;
}

export function parseArrayValue(value: string | Array<string> | null | undefined): string[] {
    if (!value) {
        return [];
    }
    if (Array.isArray(value)) {
        return value;
    }
    return JSON.parse(value);
}

export function uniqueStringFilter(value: string, index: number, self: string[]): boolean {
    return self.indexOf(value) === index;
}

export async function processInChunksAsync<TInputItem, TOutputItem>(data: {
    type: ItemType;
    log: Log;
    items: TInputItem[];
    chunkSize: number;
    processFunc: (item: TInputItem) => Promise<TOutputItem>;
    itemInfo?: (item: TInputItem) => IProcessInChunksItemInfo;
}): Promise<TOutputItem[]> {
    const chunks = splitArrayIntoChunks<TInputItem>(data.items, data.chunkSize);
    const outputItems: TOutputItem[] = [];
    let processingIndex: number = 0;

    data?.log.spinner?.start();

    try {
        for (const chunk of chunks) {
            await Promise.all(
                chunk.items.map((item) => {
                    processingIndex++;

                    if (data.itemInfo) {
                        const itemInfo = data.itemInfo(item);

                        if (data.log.spinner) {
                            data?.log.spinner?.text?.({
                                message: itemInfo.title,
                                type: data.type,
                                count: {
                                    index: processingIndex,
                                    total: data.items.length
                                }
                            });
                        } else {
                            data.log.console({
                                message: itemInfo.title,
                                type: data.type,
                                count: {
                                    index: processingIndex,
                                    total: data.items.length
                                }
                            });
                        }
                    }
                    return data.processFunc(item).then((output) => {
                        outputItems.push(output);
                    });
                })
            );
        }

        return outputItems;
    } finally {
        data?.log.spinner?.stop();
    }
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

export async function executeWithTrackingAsync<TResult>(data: {
    func: () => Promise<TResult>;
    event: ITrackingEventData;
}): Promise<TResult> {
    const trackingService = getTrackingService();
    const event = await trackingService.trackEventAsync(data.event);

    try {
        const result = await data.func();

        await trackingService.setEventResultAsync({
            eventId: event.eventId,
            result: 'success'
        });

        return result;
    } catch (error) {
        await trackingService.setEventResultAsync({
            eventId: event.eventId,
            result: 'fail'
        });

        throw error;
    }
}

export async function confirmImportAsync(data: {
    force: boolean;
    environmentId: string;
    apiKey: string;
}): Promise<void> {
    await withDefaultLogAsync(async (log) => {
        const targetEnvironment = (
            await new ManagementClient({
                apiKey: data.apiKey,
                environmentId: data.environmentId
            })
                .environmentInformation()
                .toPromise()
        ).data.project;

        if (data.force) {
            log.console({
                type: 'info',
                message: `Skipping confirmation prompt due to the use of force param`
            });
        } else {
            const confirmed = await prompts({
                type: 'confirm',
                name: 'confirm',
                message: `Are you sure to import data into ${colors.yellow(
                    targetEnvironment.environment
                )} environment of project ${colors.cyan(targetEnvironment.name)}?`
            });

            if (!confirmed.confirm) {
                log.console({
                    type: 'cancel',
                    message: `Confirmation refused. Exiting process.`
                });
                exitProcess();
            }
        }
    });
}

export function getItemsFormatService(type: ItemsFormatConfig): IItemFormatService {
    if (type === 'csv') {
        return new ItemCsvProcessorService();
    }

    if (type === 'json') {
        return new ItemJsonProcessorService();
    }

    return type;
}

export function getAssetsFormatService(type: AssetsFormatConfig): IAssetFormatService {
    if (type === 'csv') {
        return new AssetCsvProcessorService();
    }

    if (type === 'json') {
        return new AssetJsonProcessorService();
    }

    return type;
}
