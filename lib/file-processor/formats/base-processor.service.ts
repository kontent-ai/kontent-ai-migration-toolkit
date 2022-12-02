import { IContentItem, IContentType } from '@kontent-ai/delivery-sdk';
import { translationHelper } from '../../core';
import { IImportContentItem } from '../../import';
import { IFormatService, ILanguageVariantDataModel as IFlattenedLanguageVariant, ILanguageVariantsDataWrapper } from '../file-processor.models';

export abstract class BaseProcessorService implements IFormatService {
    abstract name: string;
    abstract transformLanguageVariantsAsync(
        types: IContentType[],
        items: IContentItem[]
    ): Promise<ILanguageVariantsDataWrapper[]>;

    abstract parseContentItemsAsync(text: string): Promise<IImportContentItem[]>;

    protected getBaseContentItemFields(): string[] {
        return ['codename', 'name', 'language', 'type', 'collection', 'last_modified', 'workflow_step'];
    }

    protected flattenLanguageVariants(
        items: IContentItem[],
        types: IContentType[]
    ): IFlattenedLanguageVariant[] {
        const mappedItems: IFlattenedLanguageVariant[] = [];

        for (const item of items) {
            const type = types.find((m) => m.system.codename.toLowerCase() === item.system.type.toLowerCase());

            if (!type) {
                throw Error(`Could not find type '${item.system.type}'`);
            }
            const model: IFlattenedLanguageVariant = {
                codename: item.system.codename,
                name: item.system.name,
                collection: item.system.collection,
                type: item.system.type,
                language: item.system.language,
                last_modified: item.system.lastModified,
                workflow_step: item.system.workflowStep ?? undefined
            };

            for (const element of type.elements) {
                if (element.codename) {
                    const variantElement = item.elements[element.codename];

                    if (variantElement) {
                        model[element.codename] = translationHelper.transformToExportValue(
                            variantElement,
                            items,
                            types
                        );
                    }
                }
            }

            mappedItems.push(model);
        }

        return mappedItems;
    }
}
