import { ElementType, IContentItem, IContentType } from '@kontent-ai/delivery-sdk';
import { IExportedAsset } from '../../export';
import { IParsedAsset, IParsedContentItem } from '../../import';
import { ILanguageVariantDataModel, IFileData } from '../file-processor.models';
import { BaseProcessorService } from './base-processor.service';

export class JsonProcessorService extends BaseProcessorService {
    public readonly name: string = 'json';
    async transformLanguageVariantsAsync(types: IContentType[], items: IContentItem[]): Promise<IFileData[]> {
        const typeWrappers: IFileData[] = [];
        const flattenedContentItems: ILanguageVariantDataModel[] = super.flattenLanguageVariants(items, types);
        for (const contentType of types) {
            const contentItemsOfType = flattenedContentItems.filter((m) => m.type === contentType.system.codename);

            const filename: string = `${contentType.system.codename}.json`;

            for (const itemOfType of contentItemsOfType) {
                // update  name of non-system properties
                for (const element of contentType.elements) {
                    itemOfType[this.getJsonElementName(element.codename ?? '', element.type as ElementType)] =
                        itemOfType[element.codename ?? ''];
                    delete itemOfType[element.codename ?? ''];
                }
            }

            typeWrappers.push({
                data: contentItemsOfType.length ? JSON.stringify(contentItemsOfType) : '[]',
                filename: filename
            });
        }

        return typeWrappers;
    }

    async parseContentItemsAsync(text: string): Promise<IParsedContentItem[]> {
        const parsedItems: IParsedContentItem[] = [];
        const rawItems: any[] = JSON.parse(text) as any[];
        const baseFields: string[] = this.getBaseContentItemFields();

        for (const rawItem of rawItems) {
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
                if (baseFields.includes(propertyName)) {
                    // process base field
                    contentItem[propertyName] = rawItem[propertyName];
                    continue;
                }

                // parse element name to find type & codename
                const parsedJsonNameData = this.parseJsonElementName(propertyName);

                contentItem.elements.push({
                    codename: parsedJsonNameData.elementCodename,
                    type: parsedJsonNameData.elementType,
                    value: rawItem[propertyName]
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

    private getJsonElementName(elementCodename: string, elementType: ElementType): string {
        return `${elementCodename} (${elementType})`;
    }

    private parseJsonElementName(elementName: string): { elementCodename: string; elementType: ElementType } {
        const matchedResult = elementName.match(/\(([^)]+)\)/);

        if (matchedResult && matchedResult.length > 1) {
            return {
                elementType: matchedResult[1].trim() as ElementType,
                elementCodename: elementName.replace(/ *\([^)]*\) */g, '').trim()
            };
        }

        throw Error(`Could not parse Json element name '${elementName}' to determine element type & codename`);
    }
}
