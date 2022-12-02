import { IContentItem, IContentType } from '@kontent-ai/delivery-sdk';
import { IExportedAsset } from '../../export';
import { translationHelper } from '../../core';
import { IParsedAsset, IParsedContentItem } from '../../import';
import {
    IFormatService,
    ILanguageVariantDataModel as IFlattenedLanguageVariant,
    IFileData
} from '../file-processor.models';

export abstract class BaseProcessorService implements IFormatService {
    abstract name: string;
    abstract transformLanguageVariantsAsync(types: IContentType[], items: IContentItem[]): Promise<IFileData[]>;
    abstract parseContentItemsAsync(text: string): Promise<IParsedContentItem[]>;
    abstract transformAssetsAsync(assets: IExportedAsset[]): Promise<IFileData[]>;
    abstract parseAssetsAsync(text: string): Promise<IParsedAsset[]>;

    protected getBaseContentItemFields(): string[] {
        return ['codename', 'name', 'language', 'type', 'collection', 'last_modified', 'workflow_step'];
    }

    protected getBaseAssetFields(): string[] {
        return ['assetId', 'filename', 'extension', 'url'];
    }

    protected flattenLanguageVariants(items: IContentItem[], types: IContentType[]): IFlattenedLanguageVariant[] {
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
