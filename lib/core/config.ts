import { libMetadata } from '../metadata.js';

export const coreConfig = {
    kontentTrackingHeaderName: 'X-KC-SOURCE',
    kontentTrackingHeaderValue: `${libMetadata.name};${libMetadata.version}`
} as const;
