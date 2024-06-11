import { FileBinaryData, ItemsParseData, ItemsTransformData } from '../../zip/zip.models.js';
import { BaseItemProcessorService } from './base-item-processor.service.js';
import { JsonItem, mapToJsonItem, parseJsonItem } from '../utils/item-json.utils.js';
import { MigrationItem } from '../../core/index.js';

export class ItemJsonProcessorService extends BaseItemProcessorService {
    private readonly itemsFileName: string = 'items.json';

    public readonly name: string = 'json';
    async transformAsync(data: ItemsTransformData): Promise<FileBinaryData> {
        const jsonItems: JsonItem[] = data.items.map((m) => mapToJsonItem(m));

        data.zip.addFile(this.itemsFileName, jsonItems.length ? JSON.stringify(jsonItems) : '[]');

        return await data.zip.generateZipAsync();
    }

    async parseAsync(data: ItemsParseData): Promise<MigrationItem[]> {
        const text = await data.zip.getFileContentAsync(this.itemsFileName);

        if (!text) {
            return [];
        }

        const jsonItems: JsonItem[] = JSON.parse(text);

        return jsonItems.map((m) =>
            parseJsonItem(m)
        );
    }
}
