import { ElementType, IContentType } from '@kontent-ai/delivery-sdk';
import { IImportContentItem } from '../../import';
import { ILanguageVariantDataModel, ILanguageVariantsTypeDataWrapper } from '../file-processor.models';
import { BaseProcessorService } from './base-processor.service';

export class JsonProcessorService extends BaseProcessorService {
    async mapLanguageVariantsAsync(
        types: IContentType[],
        items: ILanguageVariantDataModel[]
    ): Promise<ILanguageVariantsTypeDataWrapper[]> {
        const typeWrappers: ILanguageVariantsTypeDataWrapper[] = [];
        for (const contentType of types) {
            const contentItemsOfType = items.filter((m) => m.type === contentType.system.codename);

            const filename: string = `${contentType.system.codename}.json`;

            for (const itemOfType of contentItemsOfType) {
                // update  name of non-system properties
                for (const element of contentType.elements) {
                    itemOfType[this.getJsonElementName(element.codename ?? '', element.type as ElementType)] =
                        itemOfType[element.codename ?? ''];
                    delete itemOfType[element.codename ?? ''];
                }
            }

            typeWrappers.push({
                data: JSON.stringify(contentItemsOfType),
                contentType: contentType,
                filename: filename
            });
        }

        return typeWrappers;
    }

    parseImportItemsAsync(text: string): Promise<IImportContentItem[]> {
        throw Error('Not implemented');
    }

    private getJsonElementName(elementCodename: string, elementType: ElementType): string {
        return `${elementCodename} (${elementType})`;
    }
}
