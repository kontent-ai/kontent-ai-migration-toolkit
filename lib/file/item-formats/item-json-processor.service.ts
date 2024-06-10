import { FileBinaryData, ItemsParseData, ItemsTransformData } from '../../zip/zip.models.js';
import { BaseItemProcessorService } from './base-item-processor.service.js';
import { IJsonItem, mapToJsonItem, parseJsonItem } from './utils/item-json.utils.js';
import { IMigrationItem } from '../../core/index.js';

export class ItemJsonProcessorService extends BaseItemProcessorService {
    private readonly itemsFileName: string = 'items.json';

    public readonly name: string = 'json';
    async transformAsync(data: ItemsTransformData): Promise<FileBinaryData> {
        const jsonItems: IJsonItem[] = data.items.map((m) => mapToJsonItem(m));

        data.zip.addFile(this.itemsFileName, jsonItems.length ? JSON.stringify(jsonItems) : '[]');

        return await data.zip.generateZipAsync();
    }

    async parseAsync(data: ItemsParseData): Promise<IMigrationItem[]> {
        const text = await data.zip.getFileContentAsync(this.itemsFileName);

        if (!text) {
            return [];
        }

        const jsonItems: IJsonItem[] = JSON.parse(text);

        return jsonItems.map((m) =>
            parseJsonItem(m)
        );
    }
}
