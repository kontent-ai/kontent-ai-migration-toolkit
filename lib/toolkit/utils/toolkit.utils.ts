import { AssetJsonProcessorService, ItemJsonProcessorService } from '../../file/index.js';
import { AssetsFormatConfig, IAssetFormatService, IItemFormatService, ItemsFormatConfig } from '../../zip/index.js';

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
