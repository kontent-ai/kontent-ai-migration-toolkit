import { IContentItem, IContentType } from '@kontent-ai/delivery-sdk';
import { IItemFormatService, IFileData } from '../lib/file-processor';
import { IParsedContentItem } from '../lib/import';

export class CustomProcessorService implements IItemFormatService {
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
                system: {
                    codename: codename,
                    collection: collection,
                    language: language,
                    last_modified: '',
                    name: name,
                    type: type,
                    workflow_step: workflowStep
                },
                elements: []
            };

            parsedItems.push(contentItem);
        }

        return parsedItems;
    }
}
