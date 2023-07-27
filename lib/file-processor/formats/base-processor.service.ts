import { IContentItem, IContentType } from '@kontent-ai/delivery-sdk';
import { IExportedAsset } from '../../export';
import { translationHelper } from '../../core';
import { IImportContentType, IImportContentTypeElement, IParsedAsset, IParsedContentItem } from '../../import';
import { IFormatService, IFlattenedContentItem, IFileData } from '../file-processor.models';

export abstract class BaseProcessorService implements IFormatService {
    abstract name: string;
    abstract transformToExportDataAsync(types: IContentType[], items: IContentItem[]): Promise<IFileData[]>;
    abstract parseFromExportDataAsync(text: string, types: IImportContentType[]): Promise<IParsedContentItem[]>;
    abstract transformAssetsAsync(assets: IExportedAsset[]): Promise<IFileData[]>;
    abstract parseAssetsAsync(text: string): Promise<IParsedAsset[]>;

    protected getSystemContentItemFields(): string[] {
        return ['type', 'codename', 'name', 'language', 'collection', 'last_modified', 'workflow_step'];
    }

    protected getSystemAssetFields(): string[] {
        return ['assetId', 'filename', 'extension', 'url'];
    }

    protected flattenContentItems(items: IContentItem[], types: IContentType[]): IFlattenedContentItem[] {
        const mappedItems: IFlattenedContentItem[] = [];

        for (const item of items) {
            const type = types.find((m) => m.system.codename.toLowerCase() === item.system.type.toLowerCase());

            if (!type) {
                throw Error(`Could not find type '${item.system.type}'`);
            }
            const model: IFlattenedContentItem = {
                type: item.system.type,
                codename: item.system.codename,
                name: item.system.name,
                collection: item.system.collection,
                language: item.system.language,
                last_modified: item.system.lastModified,
                workflow_step: item.system.workflowStep ?? undefined
            };

            for (const element of type.elements) {
                if (element.codename) {
                    const variantElement = item.elements[element.codename];

                    if (variantElement) {
                        model[element.codename] = translationHelper.transformToExportElementValue(
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
