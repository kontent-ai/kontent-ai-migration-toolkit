import { FileBinaryData, ItemsParseData, ItemsTransformData } from '../../zip/zip.models.js';
import { BaseItemProcessorService } from './base-item-processor.service.js';
import { MigrationItem } from '../../core/index.js';

export class ItemJsonProcessorService extends BaseItemProcessorService {
    private readonly itemsFileName: string = 'items.json';

    public readonly name: string = 'json';
    async transformAsync(data: ItemsTransformData): Promise<FileBinaryData> {
        const migrationItems: MigrationItem[] = data.items;

        data.zip.addFile(this.itemsFileName, migrationItems.length ? JSON.stringify(migrationItems) : '[]');

        return await data.zip.generateZipAsync();
    }

    async parseAsync(data: ItemsParseData): Promise<MigrationItem[]> {
        const text = await data.zip.getFileContentAsync(this.itemsFileName);

        if (!text) {
            return [];
        }

        const migrationItems: MigrationItem[] = JSON.parse(text) as MigrationItem[];

        return migrationItems;
    }
}
