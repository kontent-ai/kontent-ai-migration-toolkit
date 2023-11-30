import {
    ContentItemElementsIndexer,
    Elements,
    ElementType,
    IContentItem,
    IContentType
} from '@kontent-ai/delivery-sdk';
import { validate } from 'uuid';
import {
    ContentItemModels,
    ElementContracts,
    LanguageVariantElements,
    LanguageVariantElementsBuilder,
    SharedContracts
} from '@kontent-ai/management-sdk';
import { IParsedContentItem } from '../import/index.js';
import { ContentElementType, IImportedData } from './core.models.js';
import { extractAssetIdFromUrl } from './global-helper.js';
import { idTranslateHelper } from './id-translate-helper.js';
import { logDebug } from './log-helper.js';

export type ExportTransformFunc = (data: {
    element: ContentItemElementsIndexer;
    items: IContentItem[];
    types: IContentType[];
}) => string | string[] | undefined;

export type ImportTransformFunc = (data: {
    value: string | string[] | undefined;
    elementCodename: string;
    importedData: IImportedData;
    sourceItems: IParsedContentItem[];
}) => ElementContracts.IContentItemElementContract;

export class TranslationHelper {
    private readonly linkCodenameAttributeName: string = 'data-manager-link-codename';
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

    private readonly importTransforms: Readonly<Record<ContentElementType, ImportTransformFunc>> = {
        guidelines: (data) => {
            throw Error(`Guidelines import transform not supported`);
        },
        snippet: (data) => {
            throw Error(`Content type snippet import transform not supported`);
        },
        subpages: (data) => {
            throw Error(`Guidelines import transform not supported`);
        },
        asset: (data) => {
            const assetReferences: SharedContracts.IReferenceObjectContract[] = [];

            for (const assetUrl of this.parseArrayValue(data.value)) {
                const assetId = extractAssetIdFromUrl(assetUrl);

                // find id of imported asset
                const importedAsset = data.importedData.assets.find((s) => s.original.assetId === assetId);

                if (!importedAsset) {
                    logDebug({
                        type: 'warning',
                        message: `Could not find imported asset for asset with original id. Skipping asset.`,
                        partA: assetId
                    });

                    continue;
                }

                assetReferences.push({
                    id: importedAsset.imported.id
                });
            }

            return this.elementsBuilder.assetElement({
                element: {
                    codename: data.elementCodename
                },
                value: assetReferences
            });
        },
        custom: (data) => {
            return this.elementsBuilder.customElement({
                element: {
                    codename: data.elementCodename
                },
                value: data.value?.toString() ?? ''
            });
        },
        date_time: (data) => {
            return this.elementsBuilder.dateTimeElement({
                element: {
                    codename: data.elementCodename
                },
                value: data.value?.toString() ?? undefined
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
            const processedRte = this.processImportRichTextHtmlValue(data.value?.toString() ?? '', data.importedData);
            const componentItems: IParsedContentItem[] = [];

            for (const componentCodename of processedRte.componentCodenames) {
                const componentItem = data.sourceItems.find((m) => m.system.codename === componentCodename);

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
                                data.importedData,
                                data.sourceItems
                            )
                        )
                        .filter((s) => s)
                        .map((s) => s as LanguageVariantElements.ILanguageVariantElementBase);

                    const componentContract: LanguageVariantElements.IRichTextComponent = {
                        id: this.convertComponentCodenameToId(m.system.codename),
                        type: {
                            codename: m.system.type
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
                value: data.value?.toString() ?? undefined
            });
        },
        url_slug: (data) => {
            return this.elementsBuilder.urlSlugElement({
                element: {
                    codename: data.elementCodename
                },
                value: data.value?.toString() ?? '',
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
        value: string | string[] | undefined,
        elementCodename: string,
        type: ContentElementType,
        importedData: IImportedData,
        sourceItems: IParsedContentItem[]
    ): ElementContracts.IContentItemElementContract | undefined {
        const transformFunc = this.importTransforms[type];

        return transformFunc({
            importedData: importedData,
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

        const linkStart: string = '<a';
        const linkEnd: string = '</a>';

        const dataItemIdStart: string = 'data-item-id=\\"';
        const dataItemIdEnd: string = '\\"';

        const linkRegex = new RegExp(`${linkStart}(.+?)${linkEnd}`, 'g');
        const dataItemIdRegex = new RegExp(`${dataItemIdStart}(.+?)${dataItemIdEnd}`);

        const processedRichText = richTextHtml.replaceAll(linkRegex, (linkTag) => {
            const idMatch = linkTag.match(dataItemIdRegex);
            console.log(idMatch);
            if (idMatch && (idMatch?.length ?? 0) >= 2) {
                const id = idMatch[1];

                // find content item with given id and replace it with codename
                const contentItemWithGivenId: IContentItem | undefined = items.find((m) => m.system.id === id);

                if (!contentItemWithGivenId) {
                    logDebug({
                        type: 'warning',
                        message: `Could not find content item with id '${id}'. This item was referenced as a link in Rich text element.`
                    });
                } else {
                    linkTag = linkTag.replace(id, contentItemWithGivenId.system.codename);
                    linkTag = linkTag.replace('data-item-id', this.linkCodenameAttributeName);
                }
            }
            return linkTag;
        });

        return {
            processedHtml: processedRichText
        };
    }

    private processImportRichTextHtmlValue(
        richTextHtml: string | undefined,
        importedData: IImportedData
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

        const csvmLinkCodenameStart: string = this.linkCodenameAttributeName + '=\\"';
        const csvmLinkCodenameEnd: string = '\\"';

        const linkRegex = new RegExp(`${linkStart}(.+?)${linkEnd}`, 'g');
        const csvmLinkCodenameRegex = new RegExp(`${csvmLinkCodenameStart}(.+?)${csvmLinkCodenameEnd}`);

        processedRichText = processedRichText.replaceAll(linkRegex, (objectTag) => {
            const codenameMatch = objectTag.match(csvmLinkCodenameRegex);
            if (codenameMatch && (codenameMatch?.length ?? 0) >= 2) {
                const codename = codenameMatch[1];

                // find content item with given codename and replace it with id
                const contentItemWithGivenCodename: ContentItemModels.ContentItem | undefined =
                    importedData.contentItems.find((m) => m.original.system.codename === codename)?.imported;

                if (!contentItemWithGivenCodename) {
                    logDebug({
                        type: 'warning',
                        message: `Could not find content item with codename '${codename}'. This item was referenced as a link in Rich text element.`
                    });
                    console.log(richTextHtml);
                } else {
                    objectTag = objectTag.replace(codename, contentItemWithGivenCodename.id);
                    objectTag = objectTag.replace(this.linkCodenameAttributeName, 'data-item-id');
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
        processedRichText = idTranslateHelper.replaceIdsInRichText(processedRichText, importedData);

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
        const uuid = codename.replaceAll('_', '-');

        if (!validate(uuid)) {
            throw Error(`Invalid uuid '${uuid}'`);
        }

        return uuid;
    }
}

export const translationHelper = new TranslationHelper();
