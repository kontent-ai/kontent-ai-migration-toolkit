import {
    ContentItemElementsIndexer,
    Elements,
    ElementType,
    IContentItem,
    IContentType
} from '@kontent-ai/delivery-sdk';
import { ElementContracts, LanguageVariantElements, LanguageVariantElementsBuilder } from '@kontent-ai/management-sdk';
import { IParsedContentItem } from '../import';
import { IImportItemResult } from './core.models';
import { extractAssetIdFromUrl } from './global-helper';
import { idTranslateHelper } from './id-translate-helper';
import { logDebug } from './log-helper';

export type ExportTransformFunc = (data: {
    element: ContentItemElementsIndexer;
    items: IContentItem[];
    types: IContentType[];
}) => string | string[] | undefined;

export type ImportTransformFunc = (data: {
    value: string | undefined;
    elementCodename: string;
    importedItems: IImportItemResult[];
    sourceItems: IParsedContentItem[];
}) => ElementContracts.IContentItemElementContract;

export class TranslationHelper {
    private readonly csvManagerLinkCodenameAttributeName: string = 'csvm-link-codename';
    private readonly elementsBuilder = new LanguageVariantElementsBuilder();

    private readonly exportTransforms: Readonly<Record<ElementType, ExportTransformFunc>> = {
        text: (data) => data.element.value,
        number: (data) => data.element.value,
        date_time: (data) => data.element.value,
        rich_text: (data) => {
            const mappedElement = data.element as Elements.RichTextElement;
            return this.processExportRichTextHtmlValue(mappedElement.value, data.items, data.types).processedHtml;
        },
        asset: (data) => {
            const mappedElement = data.element as Elements.AssetsElement;
            return mappedElement.value.map((m) => m.url);
        },
        taxonomy: (data) => {
            const mappedElement = data.element as Elements.TaxonomyElement;
            return mappedElement.value.map((m) => m.codename);
        },
        modular_content: (data) => {
            const mappedElement = data.element as Elements.LinkedItemsElement;
            return mappedElement.value.map((m) => m);
        },
        custom: (data) => data.element.value,
        url_slug: (data) => data.element.value,
        multiple_choice: (data) => {
            const mappedElement = data.element as Elements.MultipleChoiceElement;
            return mappedElement.value.map((m) => m.codename);
        },
        unknown: (data) => data.element.value
    };

    private readonly importTransforms: Readonly<Record<ElementType, ImportTransformFunc>> = {
        asset: (data) => {
            return this.elementsBuilder.assetElement({
                element: {
                    codename: data.elementCodename
                },
                value: this.parseArrayValue(data.value).map((m) => {
                    const assetId = extractAssetIdFromUrl(m);

                    // find id of imported asset
                    const importedAsset = data.importedItems.find((s) => s.originalId === assetId);

                    if (!importedAsset) {
                        throw Error(`Could not find imported asset for asset with original id '${assetId}'`);
                    }

                    return {
                        id: importedAsset.importId
                    };
                })
            });
        },
        custom: (data) => {
            return this.elementsBuilder.customElement({
                element: {
                    codename: data.elementCodename
                },
                value: data.value ?? ''
            });
        },
        date_time: (data) => {
            return this.elementsBuilder.dateTimeElement({
                element: {
                    codename: data.elementCodename
                },
                value: data.value ?? undefined
            });
        },
        modular_content: (data) => {
            return this.elementsBuilder.linkedItemsElement({
                element: {
                    codename: data.elementCodename
                },
                value: this.parseArrayValue(data.value).map((m) => {
                    return {
                        codename: m
                    };
                })
            });
        },
        multiple_choice: (data) => {
            return this.elementsBuilder.multipleChoiceElement({
                element: {
                    codename: data.elementCodename
                },
                value: this.parseArrayValue(data.value).map((m) => {
                    return {
                        codename: m
                    };
                })
            });
        },
        number: (data) => {
            return this.elementsBuilder.numberElement({
                element: {
                    codename: data.elementCodename
                },
                value: data.value ? +data.value : undefined
            });
        },
        rich_text: (data) => {
            const processedRte = this.processImportRichTextHtmlValue(data.value ?? '', data.importedItems);
            const componentItems: IParsedContentItem[] = [];

            for (const componentCodename of processedRte.componentCodenames) {
                const componentItem = data.sourceItems.find((m) => m.codename === componentCodename);

                if (!componentItem) {
                    throw Error(`Could not find component item with codename '${componentCodename}'`);
                }

                componentItems.push(componentItem);
            }

            return this.elementsBuilder.richTextElement({
                element: {
                    codename: data.elementCodename
                },
                components: componentItems.map((m) => {
                    const itemElements: LanguageVariantElements.ILanguageVariantElementBase[] = m.elements
                        .map((e) =>
                            this.transformToImportValue(
                                e.value,
                                e.codename,
                                e.type,
                                data.importedItems,
                                data.sourceItems
                            )
                        )
                        .filter((s) => s)
                        .map((s) => s as LanguageVariantElements.ILanguageVariantElementBase);

                    const componentContract: LanguageVariantElements.IRichTextComponent = {
                        id: this.convertComponentCodenameToId(m.codename),
                        type: {
                            codename: m.type
                        },
                        elements: itemElements
                    };

                    return componentContract;
                }),
                value: processedRte.processedHtml
            });
        },
        taxonomy: (data) => {
            return this.elementsBuilder.taxonomyElement({
                element: {
                    codename: data.elementCodename
                },
                value: this.parseArrayValue(data.value).map((m) => {
                    return {
                        codename: m
                    };
                })
            });
        },
        text: (data) => {
            return this.elementsBuilder.textElement({
                element: {
                    codename: data.elementCodename
                },
                value: data.value ?? undefined
            });
        },
        unknown: (data) => {
            return this.elementsBuilder.customElement({
                element: {
                    codename: data.elementCodename
                },
                value: data.value ?? undefined
            });
        },
        url_slug: (data) => {
            return this.elementsBuilder.urlSlugElement({
                element: {
                    codename: data.elementCodename
                },
                value: data.value ?? '',
                mode: 'custom'
            });
        }
    };

    transformToExportElementValue(
        element: ContentItemElementsIndexer,
        items: IContentItem[],
        types: IContentType[]
    ): string | string[] | undefined {
        const transformFunc = this.exportTransforms[element.type];

        return transformFunc({
            element: element,
            items: items,
            types: types
        });
    }

    transformToImportValue(
        value: string,
        elementCodename: string,
        type: ElementType,
        importedITems: IImportItemResult[],
        sourceItems: IParsedContentItem[]
    ): ElementContracts.IContentItemElementContract | undefined {
        const transformFunc = this.importTransforms[type];

        return transformFunc({
            importedItems: importedITems,
            elementCodename: elementCodename,
            value: value,
            sourceItems: sourceItems
        });
    }

    private parseArrayValue(value: string | Array<string> | undefined): string[] {
        if (!value) {
            return [];
        }
        if (Array.isArray(value)) {
            return value;
        }
        return JSON.parse(value);
    }

    private processExportRichTextHtmlValue(
        richTextHtml: string | undefined,
        items: IContentItem[],
        types: IContentType[]
    ): {
        processedHtml: string;
    } {
        if (!richTextHtml) {
            return {
                processedHtml: ''
            };
        }

        // extract linked items / components
        const linkStart: string = '<a';
        const linkEnd: string = '</a>';

        const dataItemIdStart: string = 'data-item-id=\\"';
        const dataItemIdEnd: string = '\\"';

        const linkRegex = new RegExp(`${linkStart}(.+?)${linkEnd}`, 'g');
        const dataItemIdRegex = new RegExp(`${dataItemIdStart}(.+?)${dataItemIdEnd}`);

        const processedRichText = richTextHtml.replaceAll(linkRegex, (objectTag) => {
            const idMatch = objectTag.match(dataItemIdRegex);
            if (idMatch && (idMatch?.length ?? 0) >= 2) {
                const id = idMatch[1];

                // find content item with given id
                const contentItemWithGivenId: IContentItem | undefined = items.find((m) => m.system.id === id);

                if (!contentItemWithGivenId) {
                    logDebug(
                        'warning',
                        `Could not find content item with id '${id}'. This item was referenced as a link in Rich text element.`
                    );
                } else {
                    objectTag = objectTag.replace(id, contentItemWithGivenId.system.codename);
                    objectTag = objectTag.replace('data-item-id', this.csvManagerLinkCodenameAttributeName);
                }
            }
            return objectTag;
        });

        return {
            processedHtml: processedRichText
        };
    }

    private processImportRichTextHtmlValue(
        richTextHtml: string | undefined,
        importItems: IImportItemResult[]
    ): {
        processedHtml: string;
        linkedItemCodenames: string[];
        componentCodenames: string[];
    } {
        const componentCodenames: string[] = [];
        const linkedItemCodenames: string[] = [];

        if (!richTextHtml) {
            return {
                linkedItemCodenames: [],
                componentCodenames: [],
                processedHtml: ''
            };
        }

        // extract linked items / components
        const objectStart: string = '<object';
        const objectEnd: string = '</object>';

        const dataCodenameStart: string = 'data-codename=\\"';
        const dataCodename: string = '\\"';

        const objectRegex = new RegExp(`${objectStart}(.+?)${objectEnd}`, 'g');
        const dataCodenameRegex = new RegExp(`${dataCodenameStart}(.+?)${dataCodename}`);

        let processedRichText = richTextHtml.replaceAll(objectRegex, (objectTag) => {
            if (objectTag.includes('type="application/kenticocloud"') && objectTag.includes('data-type="item"')) {
                const codenameMatch = objectTag.match(dataCodenameRegex);
                if (codenameMatch && (codenameMatch?.length ?? 0) >= 2) {
                    const codename = codenameMatch[1];

                    if (objectTag.includes('data-rel="component"')) {
                        objectTag = objectTag.replace('data-rel="component"', '');
                        objectTag = objectTag.replace('data-type="item"', 'data-type="component"');
                        objectTag = objectTag.replace('data-codename', 'data-id');
                        objectTag = objectTag.replace(codename, this.convertComponentCodenameToId(codename));

                        componentCodenames.push(codename);
                    } else {
                        linkedItemCodenames.push(codename);
                    }
                }
            }
            return objectTag;
        });

        // process links
        const linkStart: string = '<a';
        const linkEnd: string = '</a>';

        const csvmLinkCodenameStart: string = this.csvManagerLinkCodenameAttributeName + '=\\"';
        const csvmLinkCodenameEnd: string = '\\"';

        const linkRegex = new RegExp(`${linkStart}(.+?)${linkEnd}`, 'g');
        const csvmLinkCodenameRegex = new RegExp(`${csvmLinkCodenameStart}(.+?)${csvmLinkCodenameEnd}`);

        processedRichText = processedRichText.replaceAll(linkRegex, (objectTag) => {
            const codenameMatch = objectTag.match(csvmLinkCodenameRegex);
            if (codenameMatch && (codenameMatch?.length ?? 0) >= 2) {
                const codename = codenameMatch[1];

                // find content item with given codename and replace it with id
                const contentItemWithGivenCodename: IImportItemResult | undefined = importItems.find(
                    (m) => m.originalCodename === codename
                );

                if (!contentItemWithGivenCodename) {
                    logDebug(
                        'warning',
                        `Could not find content item with codename '${codename}'. This item was referenced as a link in Rich text element.`
                    );
                } else {
                    objectTag = objectTag.replace(codename, contentItemWithGivenCodename.importId ?? '');
                    objectTag = objectTag.replace(this.csvManagerLinkCodenameAttributeName, 'data-item-id');
                }
            }
            return objectTag;
        });

        // remove data-image-id attribute if it's present
        const imageAttrStart: string = 'data-image-id=\\"';
        const imageAttrEnd: string = '\\"';

        const imgStart: string = '<img';
        const imgEnd: string = '>';

        const imgAttrRegex = new RegExp(`${imageAttrStart}(.+?)${imageAttrEnd}`, 'g');
        const imgTagRegex = new RegExp(`${imgStart}(.+?)${imgEnd}`, 'g');

        processedRichText = processedRichText.replaceAll(imgAttrRegex, (match, $1: string) => {
            return '';
        });
        processedRichText = processedRichText.replaceAll(imgTagRegex, (match, $1: string) => {
            return '';
        });

        // replace old ids with new ids
        processedRichText = idTranslateHelper.replaceIdsInRichText(processedRichText, importItems);

        // remove unsupported attributes
        processedRichText = processedRichText.replaceAll(`data-rel="link"`, '');
        processedRichText = processedRichText.replaceAll(`href=""`, '');

        return {
            linkedItemCodenames: linkedItemCodenames,
            componentCodenames: componentCodenames,
            processedHtml: processedRichText.trim()
        };
    }

    private convertComponentCodenameToId(codename: string): string {
        return codename.replaceAll('_', '-');
    }
}

export const translationHelper = new TranslationHelper();
