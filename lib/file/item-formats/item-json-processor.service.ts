import { FileBinaryData, ItemsParseData, ItemsTransformData } from '../../zip/zip.models.js';
import { BaseItemProcessorService } from './base-item-processor.service.js';
import { IJsonItem, mapToJsonItem, parseJsonItem } from './helpers/json-item.helper.js';
import { IMigrationItem } from '../../core/index.js';

export class ItemJsonProcessorService extends BaseItemProcessorService {
    private readonly itemsFileName: string = 'items.json';

    public readonly name: string = 'json';
    async transformContentItemsAsync(data: ItemsTransformData): Promise<FileBinaryData> {
        const jsonItems: IJsonItem[] = data.items.map((m) => mapToJsonItem(m));

        data.zip.addFile(this.itemsFileName, jsonItems.length ? JSON.stringify(jsonItems) : '[]');

        return await data.zip.generateZipAsync();
    }

    async parseContentItemsAsync(data: ItemsParseData): Promise<IMigrationItem[]> {
        const text = await data.zip.getFileContentAsync(this.itemsFileName);

        if (!text) {
            return [];
        }

        const jsonItems: IJsonItem[] = JSON.parse(text);

        return jsonItems.map((m) =>
            parseJsonItem(m, (typeCodenane, elementCodename) =>
                super.getElement(data.types, typeCodenane, elementCodename)
            )
        );
    }
}
