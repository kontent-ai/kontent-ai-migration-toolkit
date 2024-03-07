import {
    ContentItemElementsIndexer,
    Elements,
    ElementType,
    IContentItem,
    IContentType
} from '@kontent-ai/delivery-sdk';
import { validate } from 'uuid';
import uuidByString from 'uuid-by-string';
import {
    AssetModels,
    ContentItemModels,
    ElementContracts,
    LanguageVariantElements,
    LanguageVariantElementsBuilder,
    SharedContracts
} from '@kontent-ai/management-sdk';
import {
    ExportTransformFunc,
    IExportTransformConfig,
    IImportedData,
    ImportTransformFunc,
    IRichTextExportConfig
} from '../core/core.models.js';
import { idTranslateHelper } from './id-translate-helper.js';
import {
    getAssetZipFilename,
    getAssetIdFromFilename,
    getAssetUrlPath,
    IMigrationItem,
    Log,
    logErrorAndExit,
    MigrationElementType
} from '../core/index.js';
import colors from 'colors';

export function getElementTranslationHelper(log: Log): ElementTranslationHelper {
    return new ElementTranslationHelper(log);
}

export class ElementTranslationHelper {
    private readonly linkCodenameAttributeName: string = 'data-manager-link-codename';
    private readonly dataNewWindowAttributeName: string = 'data-new-window';
    private readonly elementsBuilder = new LanguageVariantElementsBuilder();

    constructor(private readonly log: Log) {}

    /**
     * Elements transform used by Kontent.ai export adapter
     */
    private readonly exportTransforms: Readonly<Record<ElementType, ExportTransformFunc>> = {
        text: (data) => data.element.value,
        number: (data) => data.element.value,
        date_time: (data) => data.element.value,
        rich_text: (data) => {
            const mappedElement = data.element as Elements.RichTextElement;
            return this.processExportRichTextHtmlValue({
                item: data.item,
                items: data.items,
                richTextElement: mappedElement,
                types: data.types,
                config: data.config.richTextConfig
            }).processedHtml;
        },
        asset: (data) => {
            const mappedElement = data.element as Elements.AssetsElement;
            const assetFilenames: string[] = [];

            for (const asset of mappedElement.value) {
                const fullAssetByUrl = data.assets.find(
                    (m) => getAssetUrlPath(m.url).toLowerCase() === getAssetUrlPath(asset.url).toLowerCase()
                );

                if (!fullAssetByUrl) {
                    throw Error(`Missing asset metadata for url '${colors.red(asset.url)}'`);
                }

                assetFilenames.push(getAssetZipFilename(fullAssetByUrl));
            }

            return assetFilenames;
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

    /**
     * General import transforms used to prepare parsed element values for Management API
     */
    private readonly importTransforms: Readonly<Record<MigrationElementType, ImportTransformFunc>> = {
        guidelines: (data) => {
            logErrorAndExit({
                message: `Guidelines import transform not supported`
            });
        },
        snippet: (data) => {
            logErrorAndExit({
                message: `Content type snippet import transform not supported`
            });
        },
        subpages: (data) => {
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
        asset: (data) => {
            const assetReferences: SharedContracts.IReferenceObjectContract[] = [];

            for (const assetFilename of this.parseArrayValue(data.value)) {
                // find id of imported asset
                const importedAsset = data.importedData.assets.find(
                    (s) => s.original.assetId?.toLowerCase() === getAssetIdFromFilename(assetFilename)
                );

                if (!importedAsset) {
                    this.log.console?.({
                        type: 'warning',
                        message: `Could not find imported asset for filename '${colors.red(
                            assetFilename
                        )}'. Skipping asset.`
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
                value: data.value?.toString() ?? null
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
                value: data.value ? +data.value : null
            });
        },
        rich_text: (data) => {
            const processedRte = this.processImportRichTextHtmlValue(data.value?.toString() ?? '', data.importedData);
            const componentItems: IMigrationItem[] = [];

            for (const componentCodename of processedRte.componentCodenames) {
                const componentItem = data.sourceItems.find((m) => m.system.codename === componentCodename);

                if (!componentItem) {
                    logErrorAndExit({
                        message: `Could not find component item with codename '${colors.red(componentCodename)}'`
                    });
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
                value: data.value?.toString() ?? null
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

    transformToExportElementValue(data: {
        element: ContentItemElementsIndexer;
        item: IContentItem;
        items: IContentItem[];
        types: IContentType[];
        assets: AssetModels.Asset[];
        config: IExportTransformConfig;
    }): string | string[] | undefined {
        const transformFunc = this.exportTransforms[data.element.type];
        return transformFunc(data);
    }

    transformToImportValue(
        value: string | string[] | undefined,
        elementCodename: string,
        type: MigrationElementType,
        importedData: IImportedData,
        sourceItems: IMigrationItem[]
    ): ElementContracts.IContentItemElementContract | undefined {
        const transformFunc = this.importTransforms[type];

        return transformFunc({
            importedData: importedData,
            elementCodename: elementCodename,
            value: value,
            sourceItems: sourceItems
        });
    }

    private parseArrayValue(value: string | Array<string> | null | undefined): string[] {
        if (!value) {
            return [];
        }
        if (Array.isArray(value)) {
            return value;
        }
        return JSON.parse(value);
    }

    private processExportRichTextHtmlValue(data: {
        richTextElement: Elements.RichTextElement;
        item: IContentItem;
        items: IContentItem[];
        types: IContentType[];
        config: IRichTextExportConfig;
    }): {
        processedHtml: string;
    } {
        const richTextHtml: string = data.richTextElement.value;

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
            if (idMatch && (idMatch?.length ?? 0) >= 2) {
                const id = idMatch[1];

                // find content item with given id and replace it with codename
                const contentItemWithGivenId: IContentItem | undefined = data.items.find((m) => m.system.id === id);

                if (!contentItemWithGivenId) {
                    if (data.config.replaceInvalidLinks) {
                        // remove link tag and replace it with plain text extracted from link
                        const linkText = this.extractTextFromLinkHtml(linkTag);
                        linkTag = linkText ?? '';

                        this.log.console?.({
                            type: 'warning',
                            message: `Could not find content item with id '${colors.red(
                                id
                            )}' referenced as a link in Rich text element '${colors.yellow(
                                data.richTextElement.name
                            )}' in item '${colors.yellow(data.item.system.name)}' and language '${colors.yellow(
                                data.item.system.language
                            )}'. Replacing link with plain text.`
                        });
                    } else {
                        this.log.console?.({
                            type: 'warning',
                            message: `Could not find content item with id '${colors.red(
                                id
                            )}' referenced as a link in Rich text element '${colors.yellow(
                                data.richTextElement.name
                            )}' in item '${colors.yellow(data.item.system.name)}' and language '${colors.yellow(
                                data.item.system.language
                            )}'. This may be fixed by enabling 'replaceInvalidLinks' option.`
                        });
                    }
                } else {
                    linkTag = linkTag.replace(id, contentItemWithGivenId.system.codename);
                    linkTag = linkTag.replace('data-item-id', this.linkCodenameAttributeName);
                }
            }

            // replace multiple spaces
            linkTag = this.replaceMultipleSpacesWithSingleOne(linkTag);

            return linkTag;
        });

        return {
            processedHtml: processedRichText
        };
    }

    private extractTextFromLinkHtml(text: string): string | undefined {
        return text.match(/<a [^>]+>([^<]+)<\/a>/)?.[1];
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

            // replace multiple spaces
            objectTag = this.replaceMultipleSpacesWithSingleOne(objectTag);

            return objectTag;
        });

        // process links
        const linkStart: string = '<a';
        const linkEnd: string = '</a>';

        const csvmLinkCodenameStart: string = this.linkCodenameAttributeName + '=\\"';
        const csvmLinkCodenameEnd: string = '\\"';

        const linkRegex = new RegExp(`${linkStart}(.+?)${linkEnd}`, 'g');
        const csvmLinkCodenameRegex = new RegExp(`${csvmLinkCodenameStart}(.+?)${csvmLinkCodenameEnd}`);

        const relStart: string = 'rel="';
        const relEnd: string = '\\"';
        const relRegex = new RegExp(`${relStart}(.+?)${relEnd}`, 'g');

        const hrefStart: string = 'href="';
        const hrefEnd: string = '\\"';
        const hrefRegex = new RegExp(`${hrefStart}(.+?)${hrefEnd}`, 'g');

        processedRichText = processedRichText.replaceAll(linkRegex, (linkTag) => {
            const codenameMatch = linkTag.match(csvmLinkCodenameRegex);
            if (codenameMatch && (codenameMatch?.length ?? 0) >= 2) {
                const codename = codenameMatch[1];

                // find content item with given codename and replace it with id
                const contentItemWithGivenCodename: ContentItemModels.ContentItem | undefined =
                    importedData.contentItems.find((m) => m.original.system.codename === codename)?.imported;

                if (!contentItemWithGivenCodename) {
                    this.log.console?.({
                        type: 'warning',
                        message: `Could not find content item with codename '${colors.red(
                            codename
                        )}'. This item was referenced as a link in Rich text element.`
                    });
                } else {
                    linkTag = linkTag.replace(codename, contentItemWithGivenCodename.id);
                    linkTag = linkTag.replace(this.linkCodenameAttributeName, 'data-item-id');
                }
            }

            // make sure only valid RTE attributes for links are present
            const targetBlankAttr = 'target="_blank"';
            if (linkTag.includes(targetBlankAttr)) {
                if (linkTag.includes(this.dataNewWindowAttributeName)) {
                    linkTag = linkTag.replace(targetBlankAttr, '');
                } else {
                    linkTag = linkTag.replace(targetBlankAttr, this.dataNewWindowAttributeName);
                }
            }

            // remove rel attribute
            linkTag = linkTag.replaceAll(relRegex, (relAttr) => {
                return '';
            });

            // remove href if data-email-address is used
            const dataEmailAddress = 'data-email-address=';
            if (linkTag.includes(dataEmailAddress)) {
                linkTag = linkTag.replaceAll(hrefRegex, (hrefAttr) => {
                    return '';
                });
            }

            // replace multiple spaces
            linkTag = this.replaceMultipleSpacesWithSingleOne(linkTag);

            return linkTag;
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
        const uuidCandidate = codename.replaceAll('_', '-');

        if (!validate(uuidCandidate)) {
            // generate hash of uuid from the source
            return uuidByString(codename);
        }

        return uuidCandidate;
    }

    private replaceMultipleSpacesWithSingleOne(text: string): string {
        return text.replace(/\s+/g, ' ');
    }
}
