import { IContentType } from '@kontent-ai/delivery-sdk';
import { IImportContentItem } from '../../import';
import { IFormatService, ILanguageVariantDataModel, ILanguageVariantsDataWrapper } from '../file-processor.models';

export abstract class BaseProcessorService implements IFormatService {
    abstract mapLanguageVariantsAsync(
        types: IContentType[],
        items: ILanguageVariantDataModel[]
    ): Promise<ILanguageVariantsDataWrapper[]>;

    abstract parseImportItemsAsync(text: string): Promise<IImportContentItem[]>;

    protected getBaseContentItemFields(): string[] {
        return ['codename', 'name', 'language', 'type', 'collection', 'last_modified', 'workflow_step'];
    }
}
