import { AssetsFormat, ItemsFormat } from '../../zip/index.js';

export interface IFilesConfig {
    items: {
        filename: string;
        format: ItemsFormat;
    };
    assets: {
        filename: string;
        format: AssetsFormat;
    };
}
