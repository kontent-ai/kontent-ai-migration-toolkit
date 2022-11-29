import { IContentType } from '@kontent-ai/delivery-sdk';
import { IImportContentItem } from '../../import';
import { ILanguageVariantDataModel, ILanguageVariantsTypeDataWrapper } from '../file-processor.models';
import { BaseProcessorService } from './base-processor.service';

export class JsonProcessorService extends BaseProcessorService {
    mapLanguageVariantsAsync(
        types: IContentType[],
        items: ILanguageVariantDataModel[]
    ): Promise<ILanguageVariantsTypeDataWrapper[]> {
        throw Error('Not implemented');
    }

    parseImportItemsAsync(text: string): Promise<IImportContentItem[]> {
        throw Error('Not implemented');
    }
}
