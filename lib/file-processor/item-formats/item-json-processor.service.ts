import { FileBinaryData, ItemsParseData, ItemsTransformData } from '../file-processor.models.js';
import { BaseItemProcessorService } from '../base-item-processor.service.js';
import { IExportContentItem } from '../../export/index.js';
import { IJsonItem, ITypeWrapper, mapToJsonItem, parseJsonItem } from './helpers/json-item.helper.js';
import { IMigrationItem } from '../../core/index.js';

export class ItemJsonProcessorService extends BaseItemProcessorService {
    public readonly name: string = 'json';

    async transformContentItemsAsync(data: ItemsTransformData): Promise<FileBinaryData> {
        const typeWrappers: ITypeWrapper[] = this.getTypeWrappers(data.items);
        for (const typeWrapper of typeWrappers) {
            const filename: string = `${typeWrapper.typeCodename}.json`;
            const contentItemsOfType = data.items.filter((m) => m.system.type === typeWrapper.typeCodename);
            const jsonItems: IJsonItem[] = contentItemsOfType.map((m) => mapToJsonItem(m));

            data.zip.addFile(filename, jsonItems.length ? JSON.stringify(jsonItems) : '[]');
        }

        return await data.zip.generateZipAsync();
    }

    async parseContentItemsAsync(data: ItemsParseData): Promise<IMigrationItem[]> {
        const zipFiles = await data.zip.getAllFilesAsync<string>('string');
        const parsedItems: IMigrationItem[] = [];

        for (const zipFile of zipFiles) {
            const jsonItems: IJsonItem[] = JSON.parse(zipFile.data) as IJsonItem[];

            for (const rawItem of jsonItems) {
                parsedItems.push(
                    parseJsonItem(rawItem, (typeCodenane, elementCodename) =>
                        super.getElement(data.types, typeCodenane, elementCodename)
                    )
                );
            }
        }

        return parsedItems;
    }

    private getTypeWrappers(items: IExportContentItem[]): ITypeWrapper[] {
        const typeWrappers: ITypeWrapper[] = [];

        for (const item of items) {
            const existingFileData = typeWrappers.find((m) => m.typeCodename === item.system.type);

            if (!existingFileData) {
                typeWrappers.push({
                    typeCodename: item.system.type,
                    items: [item]
                });
            } else {
                existingFileData.items.push(item);
            }
        }

        return typeWrappers;
    }
}
