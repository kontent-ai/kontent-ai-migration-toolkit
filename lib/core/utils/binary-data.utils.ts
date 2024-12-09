import { FileBinaryData } from '../../zip/index.js';
import { defaultHttpService, defaultRetryStrategy } from './http.utils.js';

export async function getBinaryDataFromUrlAsync(url: string): Promise<{ readonly data: FileBinaryData; readonly contentLength: number }> {
    // temp fix for Kontent.ai Repository not validating url
    const fixedUrl = url.replace('#', '%23');

    const response = await defaultHttpService.getAsync<FileBinaryData>(
        {
            url: fixedUrl
        },
        {
            responseType: 'arraybuffer',
            retryStrategy: defaultRetryStrategy
        }
    );

    const contentLength = +(response.headers.find((m) => m.header.toLowerCase() === 'content-length')?.value ?? 0);

    return { data: response.data, contentLength: contentLength };
}

export function geSizeInBytes(data: FileBinaryData): number {
    return data instanceof Blob ? data.size : data.byteLength;
}
