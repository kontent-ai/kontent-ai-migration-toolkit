import { AssetModels } from '@kontent-ai/management-sdk';
import { format } from 'bytes';
import { ITrackingEventData, getTrackingService } from '@kontent-ai-consulting/tools-analytics';

export function formatBytes(bytes: number): string {
    return format(bytes);
}

export function sleepAsync(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getExtension(url: string): string | undefined {
    return url.split('.').pop();
}

export function getAssetZipFilename(asset: AssetModels.Asset): string {
    return `${asset.id}.${getExtension(asset.url)}`;
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
