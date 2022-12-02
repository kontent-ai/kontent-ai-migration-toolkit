import { IContentItem, IContentType } from '@kontent-ai/delivery-sdk';
import { IImportContentItem } from '../import';
import { IFormatService, ILanguageVariantsDataWrapper } from '../file-processor';

export class CustomProcessorService implements IFormatService {
    public readonly name: string = 'sample';
    async transformLanguageVariantsAsync(
        types: IContentType[],
        items: IContentItem[]
    ): Promise<ILanguageVariantsDataWrapper[]> {
        const typeWrappers: ILanguageVariantsDataWrapper[] = [];

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

    async parseContentItemsAsync(text: string): Promise<IImportContentItem[]> {
        const parsedItems: IImportContentItem[] = [];
        const rawItems: any[] = text.split('\n') as string[];

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

            const contentItem: IImportContentItem = {
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
}
