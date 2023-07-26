import { IContentItem, IContentType } from '@kontent-ai/delivery-sdk';
import { IExportedAsset } from '../../export';
import { IImportContentType, IParsedAsset, IParsedContentItem } from '../../import';
import { ILanguageVariantDataModel, IFileData } from '../file-processor.models';
import { BaseProcessorService } from './base-processor.service';

export class JsonProcessorService extends BaseProcessorService {
    public readonly name: string = 'json';
    async transformToExportDataAsync(types: IContentType[], items: IContentItem[]): Promise<IFileData[]> {
        const typeWrappers: IFileData[] = [];
        const flattenedContentItems: ILanguageVariantDataModel[] = super.flattenContentItems(items, types);
        for (const contentType of types) {
            const contentItemsOfType = flattenedContentItems.filter((m) => m.type === contentType.system.codename);

            const filename: string = `${contentType.system.codename}.json`;

            typeWrappers.push({
                data: contentItemsOfType.length ? JSON.stringify(contentItemsOfType) : '[]',
                filename: filename
            });
        }

        return typeWrappers;
    }

    async parseFromExportDataAsync(text: string, types: IImportContentType[]): Promise<IParsedContentItem[]> {
        const parsedItems: IParsedContentItem[] = [];
        const rawItems: any[] = JSON.parse(text) as any[];
        const systemFields: string[] = this.getSystemContentItemFields();

        for (const rawItem of rawItems) {
            const contentItemTypeCodename: string = rawItem['type'];
            const contentItem: IParsedContentItem = {
                codename: '',
                collection: '',
                elements: [],
                language: '',
                last_modified: '',
                name: '',
                type: '',
                workflow_step: ''
            };

            for (const propertyName of Object.keys(rawItem)) {
                if (systemFields.includes(propertyName)) {
                    // process base field
                    contentItem[propertyName] = rawItem[propertyName];
                    continue;
                }

                const element = super.getElement(types, contentItemTypeCodename, propertyName);

                contentItem.elements.push({
                    codename: propertyName,
                    value: rawItem[propertyName],
                    type: element.type
                });
            }

            parsedItems.push(contentItem);
        }

        return parsedItems;
    }

    async transformAssetsAsync(assets: IExportedAsset[]): Promise<IFileData[]> {
        return [
            {
                filename: 'assets.json',
                data: JSON.stringify(
                    assets.map((m) => {
                        const parsedAsset: IParsedAsset = {
                            assetId: m.assetId,
                            extension: m.extension,
                            filename: m.filename,
                            url: m.url
                        };

                        return parsedAsset;
                    })
                )
            }
        ];
    }
    async parseAssetsAsync(text: string): Promise<IParsedAsset[]> {
        return JSON.parse(text) as IParsedAsset[];
    }
}
