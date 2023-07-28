import { IContentItem, IContentType } from '@kontent-ai/delivery-sdk';
import { IExportedAsset } from '../lib/export';
import { IFormatService, IFileData } from '../lib/file-processor';
import { IParsedContentItem, IParsedAsset } from '../lib/import';

export class CustomProcessorService implements IFormatService {
    public readonly name: string = 'sample';
    async transformContentItemsAsync(types: IContentType[], items: IContentItem[]): Promise<IFileData[]> {
        const typeWrappers: IFileData[] = [];

        for (const contentType of types) {
            const contentItemsOfType = items.filter((m) => m.system.type === contentType.system.codename);

            const filename: string = `${contentType.system.codename}.txt`;

            let data: string = '';

            for (const itemOfType of contentItemsOfType) {
                data += `${itemOfType.system.type}:${itemOfType.system.codename}:${itemOfType.system.workflowStep}:${itemOfType.system.collection}:${itemOfType.system.language}:${itemOfType.system.name} \n`;
            }

            typeWrappers.push({
                data: data,
                filename: filename
            });
        }

        return typeWrappers;
    }

    async parseContentItemsAsync(text: string): Promise<IParsedContentItem[]> {
        const parsedItems: IParsedContentItem[] = [];
        const rawItems: string[] = text.split('\n');

        for (const rawItem of rawItems) {
            const splitData = rawItem.split(':');
            const type = splitData[0];
            const codename = splitData[1];
            const workflowStep = splitData[2];
            const collection = splitData[3];
            const language = splitData[4];
            const name = splitData[5];

            if (workflowStep) {
                // skip processing of items with null workflow step (e.g. components within RTE)
                continue;
            }

            const contentItem: IParsedContentItem = {
                codename: codename,
                collection: collection,
                elements: [],
                language: language,
                last_modified: '',
                name: name,
                type: type,
                workflow_step: workflowStep
            };

            parsedItems.push(contentItem);
        }

        return parsedItems;
    }

    async transformAssetsAsync(assets: IExportedAsset[]): Promise<IFileData[]> {
        return [
            {
                filename: 'assets.json',
                data: JSON.stringify(
                    assets.map((m) => {
                        const parsedAsset: IParsedAsset = {
                            assetId: m.assetId,
                            extension: m.extension,
                            filename: m.filename,
                            url: m.url
                        };

                        return parsedAsset;
                    })
                )
            }
        ];
    }
    async parseAssetsAsync(text: string): Promise<IParsedAsset[]> {
        return JSON.parse(text) as IParsedAsset[];
    }
}
