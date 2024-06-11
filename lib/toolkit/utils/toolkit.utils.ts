import { getDefaultFilename } from '../../core/index.js';
import { AssetJsonProcessorService, ItemJsonProcessorService } from '../../format/index.js';
import { AssetsFormat, AssetFormatService, ItemFormatService, ItemsFormat } from '../../zip/index.js';
import { FilesConfig } from '../models/toolkit.models.js';

export const defaultFilesConfig: FilesConfig = {
    items: {
        filename: getDefaultFilename('items'),
        format: 'json'
    },
    assets: {
        filename: getDefaultFilename('assets'),
        format: 'json'
    }
};

export function getItemsFormatService(type: ItemsFormat): ItemFormatService {
    if (type === 'json') {
        return new ItemJsonProcessorService();
    }

    return type;
}

export function getAssetsFormatService(type: AssetsFormat): AssetFormatService {
    if (type === 'json') {
        return new AssetJsonProcessorService();
    }

    return type;
}
