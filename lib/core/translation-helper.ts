import { ContentItemElementsIndexer, Elements, ElementType } from '@kontent-ai/delivery-sdk';
import { ElementContracts } from '@kontent-ai/management-sdk';
import { yellow } from 'colors';
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
        importItems: IImportItemResult[];
    }) => ElementContracts.IContentItemElementContract;
}

export class TranslationHelper {
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
                return {
                    element: {
                        codename: data.elementCodename
                    },
                    value: this.processImportRichTextHtmlValue(data.value ?? '', data.importItems)
                };
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
        importItems: IImportItemResult[]
    ): ElementContracts.IContentItemElementContract | undefined {
        const transform = this.importTransforms.find((m) => m.type === type);

        if (transform) {
            return transform.toImportValue({
                importItems: importItems,
                elementCodename: elementCodename,
                value: value
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

    private processImportRichTextHtmlValue(richTextHtml: string | undefined, importItems: IImportItemResult[]): string {
        if (!richTextHtml) {
            return '';
        }

        const imageAttrStart: string = 'data-image-id=\\"';
        const imageAttrEnd: string = '\\"';

        const imgStart: string = '<img';
        const imgEnd: string = '>';

        const imgAttrRegex = new RegExp(`${imageAttrStart}(.+?)${imageAttrEnd}`, 'g');
        const imgTagRegex = new RegExp(`${imgStart}(.+?)${imgEnd}`, 'g');

        // remove data-image-id attribute if it's present
        let processedRichText: string = richTextHtml.replaceAll(imgAttrRegex, (match, $1: string) => {
            return '';
        });
        processedRichText = processedRichText.replaceAll(imgTagRegex, (match, $1: string) => {
            return '';
        });

        // replace old ids with new ids
        processedRichText = idTranslateHelper.replaceIdsInRichText(processedRichText, importItems);

        // remove unsupported attributes
        processedRichText = processedRichText.replaceAll(`data-rel="component"`, '');
        processedRichText = processedRichText.replaceAll(`data-rel="link"`, '');
        processedRichText = processedRichText.replaceAll(`href=""`, '');

        return processedRichText.trim();
    }
}

export const translationHelper = new TranslationHelper();
