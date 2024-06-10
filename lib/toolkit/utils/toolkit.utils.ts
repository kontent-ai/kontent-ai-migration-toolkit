import { getDefaultFilename } from '../../core/index.js';
import { AssetJsonProcessorService, ItemJsonProcessorService } from '../../file/index.js';
import { AssetsFormat, IAssetFormatService, IItemFormatService, ItemsFormat } from '../../zip/index.js';
import { IFilesConfig } from '../models/toolkit.models.js';

export const defaultFilesConfig: IFilesConfig = {
    items: {
        filename: getDefaultFilename('items'),
        format: 'json'
    },
    assets: {
        filename: getDefaultFilename('assets'),
        format: 'json'
    }
};

export function getItemsFormatService(type: ItemsFormat): IItemFormatService {
    if (type === 'json') {
        return new ItemJsonProcessorService();
    }

    return type;
}

export function getAssetsFormatService(type: AssetsFormat): IAssetFormatService {
    if (type === 'json') {
        return new AssetJsonProcessorService();
    }

    return type;
}
