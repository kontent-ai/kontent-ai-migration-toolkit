import { AssetsFormat, ItemsFormat } from '../../zip/index.js';

export interface FilesConfig {
    readonly items: {
        readonly filename: string;
        readonly format: ItemsFormat;
    };
    readonly assets: {
        readonly filename: string;
        readonly format: AssetsFormat;
    };
}
