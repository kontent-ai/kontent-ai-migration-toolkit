import { IImportContentType, IParsedContentItem } from '../../import/index.js';
import { IFileData } from '../file-processor.models.js';
import { BaseItemProcessorService } from '../base-item-processor.service.js';
import { ItemJsonProcessorService } from './item-json-processor.service.js';
import { IExportContentItem } from '../../export/index.js';

interface IJsonElements {
    [elementCodename: string]: string | string[] | undefined;
}

interface IJsonItem {
    system: {
        codename: string;
        name: string;
        language: string;
        type: string;
        collection: string;
        last_modified: string;
        workflow_step?: string;
    };
    elements: IJsonElements;
}

export class ItemJsonJoinedProcessorService extends BaseItemProcessorService {
    private readonly jsonProcessorService = new ItemJsonProcessorService();

    public readonly name: string = 'json';
    async transformContentItemsAsync(items: IExportContentItem[]): Promise<IFileData[]> {
        const multiFileJsonFileData = await this.jsonProcessorService.transformContentItemsAsync(items);

        const allJsonItems: IJsonItem[] = multiFileJsonFileData
            .map((m) => {
                const items: IJsonItem[] = JSON.parse(m.data);
                return items;
            })
            .reduce<IJsonItem[]>((prev, current) => {
                prev.push(...current);
                return prev;
            }, []);

        // join data
        const joinedFileData: IFileData[] = [
            {
                data: JSON.stringify(allJsonItems),
                filename: 'items.json',
                itemsCount: allJsonItems.length
            }
        ];

        return joinedFileData;
    }

    async parseContentItemsAsync(text: string, types: IImportContentType[]): Promise<IParsedContentItem[]> {
        return await this.jsonProcessorService.parseContentItemsAsync(text, types);
    }
}
