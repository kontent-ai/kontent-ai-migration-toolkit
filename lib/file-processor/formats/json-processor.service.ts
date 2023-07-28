import { IContentItem, IContentType } from '@kontent-ai/delivery-sdk';
import { IExportedAsset } from '../../export';
import { IImportContentType, IParsedAsset, IParsedContentItem, IParsedElement } from '../../import';
import { IFileData } from '../file-processor.models';
import { BaseProcessorService } from './base-processor.service';
import { translationHelper } from '../../core';

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
        [elementCodename: string]: string | string[] | undefined;
    };
}

export class JsonProcessorService extends BaseProcessorService {
    public readonly name: string = 'json';
    async transformContentItemsAsync(types: IContentType[], items: IContentItem[]): Promise<IFileData[]> {
        const fileData: IFileData[] = [];
        for (const contentType of types) {
            const contentItemsOfType = items.filter((m) => m.system.type === contentType.system.codename);

            const filename: string = `${contentType.system.codename}.json`;
            const jsonItems: IJsonItem[] = contentItemsOfType.map((m) => this.mapToJsonItem(m, types, items));

            fileData.push({
                data: jsonItems.length ? JSON.stringify(jsonItems) : '[]',
                filename: filename
            });
        }

        return fileData;
    }

    async parseContentItemsAsync(text: string, types: IImportContentType[]): Promise<IParsedContentItem[]> {
        const parsedItems: IParsedContentItem[] = [];
        const rawItems: IJsonItem[] = JSON.parse(text) as IJsonItem[];

        for (const rawItem of rawItems) {
            const elements: IParsedElement[] = [];

            for (const propertyName of Object.keys(rawItem.elements)) {
                const element = super.getElement(types, rawItem.system.type, propertyName);

                elements.push({
                    codename: propertyName,
                    value: rawItem.elements[propertyName],
                    type: element.type
                });
            }

            const parsedItem: IParsedContentItem = {
                system: {
                    codename: rawItem.system.codename,
                    collection: rawItem.system.collection,
                    language: rawItem.system.language,
                    last_modified: rawItem.system.last_modified,
                    name: rawItem.system.name,
                    type: rawItem.system.type,
                    workflow_step: rawItem.system.workflow_step
                },
                elements: elements
            };

            parsedItems.push(parsedItem);
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

    private mapToJsonItem(item: IContentItem, types: IContentType[], items: IContentItem[]): IJsonItem {
        const elements: { [elementCodename: string]: string | string[] | undefined } = {};

        const type = types.find((m) => m.system.codename === item.system.type);

        if (!type) {
            throw Error(`Missing content type '${item.system.type}' for item '${item.system.codename}'`);
        }

        for (const element of type.elements) {
            if (element.codename) {
                const variantElement = item.elements[element.codename];

                if (variantElement) {
                    elements[element.codename] = translationHelper.transformToExportElementValue(
                        variantElement,
                        items,
                        types
                    );
                }
            }
        }

        const jsonItem: IJsonItem = {
            system: {
                codename: item.system.codename,
                collection: item.system.collection,
                language: item.system.language,
                last_modified: item.system.lastModified,
                name: item.system.name,
                type: item.system.type,
                workflow_step: item.system.workflowStep ?? undefined
            },
            elements: elements
        };
        return jsonItem;
    }
}
