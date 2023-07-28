import { IContentItem, IContentType } from '@kontent-ai/delivery-sdk';
import { IExportedAsset } from '../../export';
import { IImportContentType, IParsedAsset, IParsedContentItem } from '../../import';
import { IFileData } from '../file-processor.models';
import { BaseProcessorService } from './base-processor.service';
import { JsonProcessorService } from './json-processor.service';

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

export class JsonSingleProcessorService extends BaseProcessorService {
    private readonly jsonProcessorService = new JsonProcessorService();

    public readonly name: string = 'json';
    async transformContentItemsAsync(types: IContentType[], items: IContentItem[]): Promise<IFileData[]> {
        const multiFileJsonFileData = await this.jsonProcessorService.transformContentItemsAsync(types, items);

        const allJsonItems: IJsonItem[] = multiFileJsonFileData
            .map((m) => {
                let items: IJsonItem[] = JSON.parse(m.data);
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
                filename: 'export.json'
            }
        ];

        return joinedFileData;
    }

    async parseContentItemsAsync(text: string, types: IImportContentType[]): Promise<IParsedContentItem[]> {
        return await this.jsonProcessorService.parseContentItemsAsync(text, types);
    }

    async transformAssetsAsync(assets: IExportedAsset[]): Promise<IFileData[]> {
        return await this.jsonProcessorService.transformAssetsAsync(assets);
    }
    async parseAssetsAsync(text: string): Promise<IParsedAsset[]> {
        return await this.jsonProcessorService.parseAssetsAsync(text);
    }
}
