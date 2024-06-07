import { getDefaultFilename } from '../../core/index.js';
import { AssetJsonProcessorService, ItemJsonProcessorService } from '../../file/index.js';
import { AssetsFormatConfig, IAssetFormatService, IItemFormatService, ItemsFormatConfig } from '../../zip/index.js';
import { IFilesConfig } from '../models/toolkit.models.js';

export const defaultFilesConfig: IFilesConfig = {
    items: {
        filename: getDefaultFilename('items'),
        formatService: 'json'
    },
    assets: {
        filename: getDefaultFilename('assets'),
        formatService: 'json'
    }
};

export function getItemsFormatService(type: ItemsFormatConfig): IItemFormatService {
    if (type === 'json') {
        return new ItemJsonProcessorService();
    }

    return type;
}

export function getAssetsFormatService(type: AssetsFormatConfig): IAssetFormatService {
    if (type === 'json') {
        return new AssetJsonProcessorService();
    }

    return type;
}
