import { IContentItem, IContentType } from '@kontent-ai/delivery-sdk';
import { IImportContentType, IImportContentTypeElement, IParsedContentItem } from '../import/index.js';
import { IItemFormatService, IFileData } from './file-processor.models.js';
import { IExportTransformConfig } from 'lib/index.js';

export abstract class BaseItemProcessorService implements IItemFormatService {
    abstract name: string;
    abstract transformContentItemsAsync(
        types: IContentType[],
        items: IContentItem[],
        config: IExportTransformConfig
    ): Promise<IFileData[]>;
    abstract parseContentItemsAsync(text: string, types: IImportContentType[]): Promise<IParsedContentItem[]>;

    protected getSystemContentItemFields(): string[] {
        return ['type', 'codename', 'name', 'language', 'collection', 'last_modified', 'workflow_step'];
    }

    protected getElement(
        types: IImportContentType[],
        contentItemType: string,
        elementCodename: string
    ): IImportContentTypeElement {
        const type = types.find((m) => m.contentTypeCodename.toLowerCase() === contentItemType.toLowerCase());

        if (!type) {
            throw Error(`Could not find content type '${contentItemType}'`);
        }

        const element = type.elements.find((m) => m.codename.toLowerCase() === elementCodename.toLowerCase());

        if (!element) {
            throw Error(
                `Could not find element with codename '${elementCodename}' for type '${type.contentTypeCodename}'`
            );
        }

        return element;
    }
}
