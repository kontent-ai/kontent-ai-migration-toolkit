import { AssetsFormatConfig, ItemsFormatConfig } from '../../zip/index.js';

export interface IFilesConfig {
    items: {
        filename: string;
        formatService: ItemsFormatConfig;
    };
    assets: {
        filename: string;
        formatService: AssetsFormatConfig;
    };
}
