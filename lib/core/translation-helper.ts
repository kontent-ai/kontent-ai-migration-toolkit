import { ContentItemElementsIndexer, Elements, ElementType } from '@kontent-ai/delivery-sdk';
import { ElementContracts } from '@kontent-ai/management-sdk';
import { yellow } from 'colors';
import { defaultObjectId } from './core-properties';
import { IIdCodenameTranslationResult } from './core.models';

interface IElementTransform {
    type: ElementType;
    toExportValue: (element: ContentItemElementsIndexer) => string | string[] | undefined;
    toImportValue: (value: string | undefined, elementCodename: string) => ElementContracts.IContentItemElementContract;
}

export class TranslationHelper {
    private readonly transforms: IElementTransform[] = [
        {
            type: ElementType.Text,
            toExportValue: (element) => element.value,
            toImportValue: (value, elementCodename) => {
                return {
                    element: {
                        codename: elementCodename
                    },
                    value: value ?? ''
                };
            }
        },
        {
            type: ElementType.Number,
            toExportValue: (element) => element.value,
            toImportValue: (value, elementCodename) => {
                return {
                    element: {
                        codename: elementCodename
                    },
                    value: value ?? ''
                };
            }
        },
        {
            type: ElementType.DateTime,
            toExportValue: (element) => element.value,
            toImportValue: (value, elementCodename) => {
                return {
                    element: {
                        codename: elementCodename
                    },
                    value: value ?? ''
                };
            }
        },
        {
            type: ElementType.RichText,
            toExportValue: (element) => {
                const mappedElement = element as Elements.RichTextElement;
                return mappedElement.value;
            },
            toImportValue: (value, elementCodename) => {
                return {
                    element: {
                        codename: elementCodename
                    },
                    value: value ?? ''
                };
            }
        },
        {
            type: ElementType.Asset,
            toExportValue: (element) => {
                const mappedElement = element as Elements.AssetsElement;
                return mappedElement.value.map((m) => m.url);
            },
            toImportValue: (value, elementCodename) => {
                return {
                    element: {
                        codename: elementCodename
                    },
                    value: this.parseArrayValue(value).map((m) => {
                        return {
                            codename: m
                        };
                    })
                };
            }
        },
        {
            type: ElementType.Taxonomy,
            toExportValue: (element) => {
                const mappedElement = element as Elements.TaxonomyElement;
                return mappedElement.value.map((m) => m.codename);
            },
            toImportValue: (value, elementCodename) => {
                return {
                    element: {
                        codename: elementCodename
                    },
                    value: this.parseArrayValue(value).map((m) => {
                        return {
                            codename: m
                        };
                    })
                };
            }
        },
        {
            type: ElementType.ModularContent,
            toExportValue: (element) => {
                const mappedElement = element as Elements.LinkedItemsElement;
                return mappedElement.value.map((m) => m);
            },
            toImportValue: (value, elementCodename) => {
                return {
                    element: {
                        codename: elementCodename
                    },
                    value: this.parseArrayValue(value).map((m) => {
                        return {
                            codename: m
                        };
                    })
                };
            }
        },
        {
            type: ElementType.UrlSlug,
            toExportValue: (element) => element.value,
            toImportValue: (value, elementCodename) => {
                return {
                    element: {
                        codename: elementCodename
                    },
                    value: value ?? ''
                };
            }
        },
        {
            type: ElementType.Custom,
            toExportValue: (element) => element.value,
            toImportValue: (value, elementCodename) => {
                return {
                    element: {
                        codename: elementCodename
                    },
                    value: value ?? ''
                };
            }
        },
        {
            type: ElementType.MultipleChoice,
            toExportValue: (element) => {
                const mappedElement = element as Elements.MultipleChoiceElement;
                return mappedElement.value.map((m) => m.codename);
            },
            toImportValue: (value, elementCodename) => {
                return {
                    element: {
                        codename: elementCodename
                    },
                    value: this.parseArrayValue(value).map((m) => {
                        return {
                            codename: m
                        };
                    })
                };
            }
        }
    ];

    transformToExportValue(element: ContentItemElementsIndexer): string | string[] | undefined {
        const transform = this.transforms.find((m) => m.type === element.type);

        if (transform) {
            return transform.toExportValue(element);
        }

        console.log(`Missing transform for element type '${yellow(element.type)}'`);

        return '';
    }

    transformToImportValue(
        value: string,
        elementCodename: string,
        type: ElementType
    ): ElementContracts.IContentItemElementContract | undefined {
        const transform = this.transforms.find((m) => m.type === type);

        if (transform) {
            return transform.toImportValue(value, elementCodename);
        }

        console.log(`Missing transform for element type '${yellow(type)}'`);

        return undefined;
    }

    private parseArrayValue(value: string | undefined): string[] {
        if (!value) {
            return [];
        }
        return JSON.parse(value);
    }

    public replaceIdReferencesWithExternalId(data: any): void {
        if (data) {
            if (Array.isArray(data)) {
                for (const arrayItem of data) {
                    this.replaceIdReferencesWithExternalId(arrayItem);
                }
            } else {
                for (const key of Object.keys(data)) {
                    const val = (data as any)[key];
                    if (key.toLowerCase() === 'id') {
                        const id = (data as any).id;

                        if (id) {
                            data.external_id = id;
                            delete data.id;
                        }
                    }

                    if (typeof val === 'object' && val !== null) {
                        this.replaceIdReferencesWithExternalId(val);
                    }
                }
            }
        }
    }

    public replaceIdReferencesWithCodenames(
        data: any,
        allData: any,
        storedCodenames: IIdCodenameTranslationResult,
        codenameForDefaultId?: string
    ): void {
        if (data) {
            if (Array.isArray(data)) {
                for (const arrayItem of data) {
                    this.replaceIdReferencesWithCodenames(arrayItem, allData, storedCodenames, codenameForDefaultId);
                }
            } else {
                for (const key of Object.keys(data)) {
                    const val = (data as any)[key];
                    if (key.toLowerCase() === 'id') {
                        const id = (data as any).id;
                        const codename = (data as any).codename;

                        if (!codename) {
                            let foundCodename: string | undefined;
                            if (id.toLowerCase() === defaultObjectId.toLowerCase() && codenameForDefaultId) {
                                foundCodename = codenameForDefaultId;
                            } else {
                                foundCodename = this.tryFindCodenameForId(id, allData, storedCodenames);
                            }

                            // replace id with codename
                            if (foundCodename) {
                                // remove id prop
                                delete data.id;

                                // set codename prop
                                data.codename = foundCodename;
                            }
                        }
                    }

                    if (typeof val === 'object' && val !== null) {
                        this.replaceIdReferencesWithCodenames(val, allData, storedCodenames, codenameForDefaultId);
                    }
                }
            }
        }
    }

    public tryFindCodenameForId(
        findId: string,
        data: any,
        storedCodenames: IIdCodenameTranslationResult,
        foundCodename?: string
    ): string | undefined {
        // try looking up codename in stored references
        const storedCodename = storedCodenames[findId];

        if (storedCodename) {
            return storedCodename;
        }

        if (data) {
            if (Array.isArray(data)) {
                for (const arrayItem of data) {
                    foundCodename = this.tryFindCodenameForId(findId, arrayItem, storedCodenames, foundCodename);
                }
            } else {
                for (const key of Object.keys(data)) {
                    const val = (data as any)[key];
                    let candidateId: string | undefined;

                    if (key.toLowerCase() === 'id') {
                        candidateId = (data as any).id;
                    }

                    if (key.toLocaleLowerCase() === 'external_id') {
                        candidateId = (data as any).external_id;
                    }

                    if (candidateId) {
                        const codename = (data as any).codename;

                        if (codename) {
                            // store id -> codename mapping so that we don't have to always
                            // search for it as its expensive operation
                            storedCodenames[candidateId] = codename;
                        }

                        if (codename && candidateId === findId) {
                            return codename;
                        }
                    }
                    if (typeof val === 'object' && val !== null) {
                        foundCodename = this.tryFindCodenameForId(findId, val, storedCodenames, foundCodename);
                    }
                }
            }
        }
        return foundCodename;
    }
}

export const translationHelper = new TranslationHelper();
