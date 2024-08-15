import { defaultHttpService, defaultRetryStrategy } from './http.utils.js';

export async function getBinaryDataFromUrlAsync(url: string): Promise<{ data: Buffer | Blob; contentLength: number }> {
    // temp fix for Kontent.ai Repository not validating url
    url = url.replace('#', '%23');

    const response = await defaultHttpService.getAsync<Buffer | Blob>(
        {
            url
        },
        {
            responseType: 'arraybuffer',
            retryStrategy: defaultRetryStrategy
        }
    );

    const contentLength = +(response.headers.find((m) => m.header.toLowerCase() === 'content-length')?.value ?? 0);

    return { data: response.data, contentLength: contentLength };
}

export function geSizeInBytes(data: Blob | Buffer): number {
    return data instanceof Blob ? data.size : data.byteLength;
}
