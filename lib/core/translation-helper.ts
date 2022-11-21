import { ContentItemElementsIndexer, Elements, ElementType } from '@kontent-ai/delivery-sdk';
import { ElementContracts, LanguageVariantElements, LanguageVariantElementsBuilder } from '@kontent-ai/management-sdk';
import { yellow } from 'colors';
import { IImportContentItem } from '../import';
import { IImportItemResult } from './core.models';
import { extractAssetIdFromUrl } from './global-helper';
import { idTranslateHelper } from './id-translate-helper';

export interface IExportTransform {
    type: ElementType;
    toExportValue: (element: ContentItemElementsIndexer) => string | string[] | undefined;
}

export interface IImportTransform {
    type: ElementType;
    toImportValue: (data: {
        value: string | undefined;
        elementCodename: string;
        importedItems: IImportItemResult[];
        sourceItems: IImportContentItem[];
    }) => ElementContracts.IContentItemElementContract;
}

export class TranslationHelper {
    private readonly elementsBuilder = new LanguageVariantElementsBuilder();

    private readonly exportTransforms: IExportTransform[] = [
        {
            type: ElementType.Text,
            toExportValue: (element) => element.value
        },
        {
            type: ElementType.Number,
            toExportValue: (element) => element.value
        },
        {
            type: ElementType.DateTime,
            toExportValue: (element) => element.value
        },
        {
            type: ElementType.RichText,
            toExportValue: (element) => {
                const mappedElement = element as Elements.RichTextElement;
                return mappedElement.value;
            }
        },
        {
            type: ElementType.Asset,
            toExportValue: (element) => {
                const mappedElement = element as Elements.AssetsElement;
                return mappedElement.value.map((m) => m.url);
            }
        },
        {
            type: ElementType.Taxonomy,
            toExportValue: (element) => {
                const mappedElement = element as Elements.TaxonomyElement;
                return mappedElement.value.map((m) => m.codename);
            }
        },
        {
            type: ElementType.ModularContent,
            toExportValue: (element) => {
                const mappedElement = element as Elements.LinkedItemsElement;
                return mappedElement.value.map((m) => m);
            }
        },
        {
            type: ElementType.UrlSlug,
            toExportValue: (element) => element.value
        },
        {
            type: ElementType.Custom,
            toExportValue: (element) => element.value
        },
        {
            type: ElementType.MultipleChoice,
            toExportValue: (element) => {
                const mappedElement = element as Elements.MultipleChoiceElement;
                return mappedElement.value.map((m) => m.codename);
            }
        }
    ];

    private readonly importTransforms: IImportTransform[] = [
        {
            type: ElementType.Text,
            toImportValue: (data) => {
                return {
                    element: {
                        codename: data.elementCodename
                    },
                    value: data.value ?? ''
                };
            }
        },
        {
            type: ElementType.Number,
            toImportValue: (data) => {
                return {
                    element: {
                        codename: data.elementCodename
                    },
                    value: data.value ?? ''
                };
            }
        },
        {
            type: ElementType.DateTime,
            toImportValue: (data) => {
                return {
                    element: {
                        codename: data.elementCodename
                    },
                    value: data.value ?? ''
                };
            }
        },
        {
            type: ElementType.RichText,
            toImportValue: (data) => {
                const processedRte = this.processImportRichTextHtmlValue(data.value ?? '', data.importedItems);
                const componentItems: IImportContentItem[] = [];

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
                            .filter((m) => m)
                            .map((m) => m as LanguageVariantElements.ILanguageVariantElementBase);

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
            }
        },
        {
            type: ElementType.Asset,
            toImportValue: (data) => {
                return {
                    element: {
                        codename: data.elementCodename
                    },
                    value: this.parseArrayValue(data.value).map((m) => {
                        return {
                            id: extractAssetIdFromUrl(m)
                        };
                    })
                };
            }
        },
        {
            type: ElementType.Taxonomy,
            toImportValue: (data) => {
                return {
                    element: {
                        codename: data.elementCodename
                    },
                    value: this.parseArrayValue(data.value).map((m) => {
                        return {
                            codename: m
                        };
                    })
                };
            }
        },
        {
            type: ElementType.ModularContent,
            toImportValue: (data) => {
                return {
                    element: {
                        codename: data.elementCodename
                    },
                    value: this.parseArrayValue(data.value).map((m) => {
                        return {
                            codename: m
                        };
                    })
                };
            }
        },
        {
            type: ElementType.UrlSlug,
            toImportValue: (data) => {
                return {
                    element: {
                        codename: data.elementCodename
                    },
                    value: data.value ?? '',
                    mode: 'custom'
                };
            }
        },
        {
            type: ElementType.Custom,
            toImportValue: (data) => {
                return {
                    element: {
                        codename: data.elementCodename
                    },
                    value: data.value ?? ''
                };
            }
        },
        {
            type: ElementType.MultipleChoice,

            toImportValue: (data) => {
                return {
                    element: {
                        codename: data.elementCodename
                    },
                    value: this.parseArrayValue(data.value).map((m) => {
                        return {
                            codename: m
                        };
                    })
                };
            }
        }
    ];

    transformToExportValue(element: ContentItemElementsIndexer): string | string[] | undefined {
        const transform = this.exportTransforms.find((m) => m.type === element.type);

        if (transform) {
            return transform.toExportValue(element);
        }

        console.log(`Missing export transform for element type '${yellow(element.type)}'`);

        return '';
    }

    transformToImportValue(
        value: string,
        elementCodename: string,
        type: ElementType,
        importedITems: IImportItemResult[],
        sourceItems: IImportContentItem[]
    ): ElementContracts.IContentItemElementContract | undefined {
        const transform = this.importTransforms.find((m) => m.type === type);

        if (transform) {
            return transform.toImportValue({
                importedItems: importedITems,
                elementCodename: elementCodename,
                value: value,
                sourceItems: sourceItems
            });
        }

        console.log(`Missing import transform for element type '${yellow(type)}'`);

        return undefined;
    }

    private parseArrayValue(value: string | undefined): string[] {
        if (!value) {
            return [];
        }
        return JSON.parse(value);
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
                        console.log('is component');
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
        // processedRichText = processedRichText.replaceAll(`data-rel="component"`, '');
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
