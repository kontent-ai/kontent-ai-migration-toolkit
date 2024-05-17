import { AssetModels, SharedModels } from '@kontent-ai/management-sdk';
import { format } from 'bytes';
import colors from 'colors';
import { IErrorData } from '../models/core.models.js';
import { ITrackingEventData, getTrackingService } from '@kontent-ai-consulting/tools-analytics';

export function exitProcess(): never {
    process.exit(1);
}

export function formatBytes(bytes: number): string {
    return format(bytes);
}

export function sleepAsync(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

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

export function getItemExternalIdForCodename(codename: string): string {
    return `content_item_${codename}`;
}

export function getAssetExternalIdForCodename(codename: string): string {
    return `asset_${codename}`;
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
