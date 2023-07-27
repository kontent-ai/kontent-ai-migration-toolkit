import { IContentItem, IContentType } from '@kontent-ai/delivery-sdk';
import { IExportedAsset } from '../../export';
import { IImportContentType, IParsedAsset, IParsedContentItem } from '../../import';
import { IFlattenedContentItem, IFileData } from '../file-processor.models';
import { BaseProcessorService } from './base-processor.service';

interface IJsonItem {
    system: {
        codename: string;
        name: string;
        language: string;
        type: string;
        collection: string;
        last_modified: string;
        workflow_step?: string;
    };
    elements: {
        [elementCodename: string]: string;
    };
}

export class JsonProcessorService extends BaseProcessorService {
    public readonly name: string = 'json';
    async transformToExportDataAsync(types: IContentType[], items: IContentItem[]): Promise<IFileData[]> {
        const systemProperties = super.getSystemContentItemFields();
        const typeWrappers: IFileData[] = [];
        const flattenedContentItems: IFlattenedContentItem[] = super.flattenContentItems(items, types);
        for (const contentType of types) {
            const contentItemsOfType = flattenedContentItems.filter((m) => m.type === contentType.system.codename);

            const filename: string = `${contentType.system.codename}.json`;
            const jsonItems: IJsonItem[] = contentItemsOfType.map((m) => {
                const elements: { [elementCodename: string]: string } = {};
                for (const property of Object.keys(m)) {
                    if (!systemProperties.find((s) => s === property)) {
                        elements[property] = m[property];
                    }
                }

                const jsonItem: IJsonItem = {
                    system: {
                        codename: m.codename,
                        collection: m.collection,
                        language: m.language,
                        last_modified: m.language,
                        name: m.name,
                        type: m.type,
                        workflow_step: m.workflow_step
                    },
                    elements: elements
                };
                return jsonItem;
            });

            typeWrappers.push({
                data: jsonItems.length ? JSON.stringify(jsonItems) : '[]',
                filename: filename
            });
        }

        return typeWrappers;
    }

    async parseFromExportDataAsync(text: string, types: IImportContentType[]): Promise<IParsedContentItem[]> {
        const parsedItems: IParsedContentItem[] = [];
        const rawItems: IJsonItem[] = JSON.parse(text) as IJsonItem[];
        const systemFields: string[] = this.getSystemContentItemFields();

        for (const rawItem of rawItems) {
            const contentItem: IParsedContentItem = {
                codename: rawItem.system.codename,
                collection: rawItem.system.collection,
                elements: [],
                language: rawItem.system.language,
                last_modified: rawItem.system.last_modified,
                name: rawItem.system.name,
                type: rawItem.system.type,
                workflow_step: rawItem.system.workflow_step
            };

            for (const propertyName of Object.keys(rawItem.elements)) {
                if (systemFields.includes(propertyName)) {
                    // skip base field
                    continue;
                }

                const element = super.getElement(types, rawItem.system.type, propertyName);

                contentItem.elements.push({
                    codename: propertyName,
                    value: rawItem.elements[propertyName],
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
