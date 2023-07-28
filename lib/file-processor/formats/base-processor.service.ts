import { IContentItem, IContentType } from '@kontent-ai/delivery-sdk';
import { IExportedAsset } from '../../export';
import { IImportContentType, IImportContentTypeElement, IParsedAsset, IParsedContentItem } from '../../import';
import { IFormatService, IFileData } from '../file-processor.models';

export abstract class BaseProcessorService implements IFormatService {
    abstract name: string;
    abstract transformContentItemsAsync(types: IContentType[], items: IContentItem[]): Promise<IFileData[]>;
    abstract parseContentItemsAsync(text: string, types: IImportContentType[]): Promise<IParsedContentItem[]>;
    abstract transformAssetsAsync(assets: IExportedAsset[]): Promise<IFileData[]>;
    abstract parseAssetsAsync(text: string): Promise<IParsedAsset[]>;

    protected getSystemContentItemFields(): string[] {
        return ['codename', 'name', 'language', 'type', 'collection', 'last_modified', 'workflow_step'];
    }

    protected getSystemAssetFields(): string[] {
        return ['assetId', 'filename', 'extension', 'url'];
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
