import { IContentItem, IContentType } from '@kontent-ai/delivery-sdk';
import { IImportContentType, IParsedContentItem } from '../../import';
import { IFileData } from '../file-processor.models';
import { BaseItemProcessorService } from '../base-item-processor.service';
import { ItemJsonProcessorService } from './item-json-processor.service';

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
    elements: {
        [elementCodename: string]: string | string[] | undefined;
    };
}

export class ItemJsonSingleProcessorService extends BaseItemProcessorService {
    private readonly jsonProcessorService = new ItemJsonProcessorService();

    public readonly name: string = 'json';
    async transformContentItemsAsync(types: IContentType[], items: IContentItem[]): Promise<IFileData[]> {
        const multiFileJsonFileData = await this.jsonProcessorService.transformContentItemsAsync(types, items);

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
                filename: 'items.json'
            }
        ];

        return joinedFileData;
    }

    async parseContentItemsAsync(text: string, types: IImportContentType[]): Promise<IParsedContentItem[]> {
        return await this.jsonProcessorService.parseContentItemsAsync(text, types);
    }
}
