import { SharedContracts, LanguageVariantElementsBuilder } from '@kontent-ai/management-sdk';
import {
    ImportTransformFunc,
    parseArrayValue,
    logErrorAndExit,
    MigrationElementType,
    IImportContext
} from '../../core/index.js';
import { RichTextService, getRichTextService } from '../rich-text.service.js';

const elementsBuilder = new LanguageVariantElementsBuilder();
const richTextService: RichTextService = getRichTextService();

/**
 * General import transforms used to prepare parsed element values for Management API
 */
export const importTransforms: Readonly<Record<MigrationElementType, ImportTransformFunc>> = {
    guidelines: async (data) => {
        logErrorAndExit({
            message: `Guidelines import transform not supported`
        });
    },
    snippet: async (data) => {
        logErrorAndExit({
            message: `Content type snippet import transform not supported`
        });
    },
    subpages: async (data) => {
        return elementsBuilder.linkedItemsElement({
            element: {
                codename: data.elementCodename
            },
            value: parseArrayValue(data.value).map((m) => {
                return {
                    codename: m
                };
            })
        });
    },
    asset: async (data) => {
        const assetReferences: SharedContracts.IReferenceObjectContract[] = [];

        for (const assetCodename of parseArrayValue(data.value)) {
            // check if asset already exists in target env
            const assetStateInTargetEnv = data.importContext.getAssetStateInTargetEnvironment(assetCodename);

            if (assetStateInTargetEnv.state === 'exists' && assetStateInTargetEnv.asset) {
                // asset exists, use its id as reference
                assetReferences.push({
                    id: assetStateInTargetEnv.asset.id
                });
            } else {
                // reference it via external id otherwise
                assetReferences.push({
                    external_id: assetStateInTargetEnv.externalIdToUse
                });
            }
        }

        return elementsBuilder.assetElement({
            element: {
                codename: data.elementCodename
            },
            value: assetReferences
        });
    },
    custom: async (data) => {
        return elementsBuilder.customElement({
            element: {
                codename: data.elementCodename
            },
            value: data.value?.toString() ?? ''
        });
    },
    date_time: async (data) => {
        return elementsBuilder.dateTimeElement({
            element: {
                codename: data.elementCodename
            },
            value: data.value?.toString() ?? null
        });
    },
    modular_content: async (data) => {
        const value: SharedContracts.IReferenceObjectContract[] = [];
        const linkedItemCodenames: string[] = parseArrayValue(data.value);

        for (const linkedItemCodename of linkedItemCodenames) {
            const itemState = data.importContext.getItemStateInTargetEnvironment(linkedItemCodename);

            if (itemState.item) {
                // linked item already exists in target environment
                value.push({
                    codename: itemState.codename
                });
            } else {
                // linked item is new, reference it with external id
                value.push({
                    external_id: itemState.externalIdToUse
                });
            }
        }

        return elementsBuilder.linkedItemsElement({
            element: {
                codename: data.elementCodename
            },
            value: value
        });
    },
    multiple_choice: async (data) => {
        return elementsBuilder.multipleChoiceElement({
            element: {
                codename: data.elementCodename
            },
            value: parseArrayValue(data.value).map((m) => {
                return {
                    codename: m
                };
            })
        });
    },
    number: async (data) => {
        return elementsBuilder.numberElement({
            element: {
                codename: data.elementCodename
            },
            value: data.value ? +data.value : null
        });
    },
    rich_text: async (data) => {
        const rteHtml = await processImportRichTextHtmlValueAsync(data.value?.toString(), data.importContext);

        return elementsBuilder.richTextElement({
            element: {
                codename: data.elementCodename
            },
            value: rteHtml ?? null
        });
    },
    taxonomy: async (data) => {
        return elementsBuilder.taxonomyElement({
            element: {
                codename: data.elementCodename
            },
            value: parseArrayValue(data.value).map((m) => {
                return {
                    codename: m
                };
            })
        });
    },
    text: async (data) => {
        return elementsBuilder.textElement({
            element: {
                codename: data.elementCodename
            },
            value: data.value?.toString() ?? null
        });
    },
    url_slug: async (data) => {
        return elementsBuilder.urlSlugElement({
            element: {
                codename: data.elementCodename
            },
            value: data.value?.toString() ?? '',
            mode: 'custom'
        });
    }
};

async function processImportRichTextHtmlValueAsync(
    richTextHtml: string | undefined,
    importContext: IImportContext
): Promise<string | undefined> {
    if (!richTextHtml) {
        return richTextHtml;
    }

    // replace item codenames with id or external_id
    richTextHtml = richTextService.processRteItemCodenames(richTextHtml, (codename) => {
        const itemState = importContext.getItemStateInTargetEnvironment(codename);

        if (itemState.state === 'exists' && itemState.item) {
            return {
                id: itemState.item.id
            };
        } else {
            return {
                external_id: itemState.externalIdToUse
            };
        }
    }).html;

    // replace link item codenames with id or external_id
    richTextHtml = richTextService.processRteLinkItemCodenames(richTextHtml, (codename) => {
        const itemState = importContext.getItemStateInTargetEnvironment(codename);

        if (itemState.state === 'exists' && itemState.item) {
            return {
                id: itemState.item.id
            };
        } else {
            return {
                external_id: itemState.externalIdToUse
            };
        }
    }).html;

    // replace asset codenames with id or external_id
    richTextHtml = richTextService.processRteAssetCodenames(richTextHtml, (codename) => {
        const assetState = importContext.getAssetStateInTargetEnvironment(codename);

        if (assetState.state === 'exists' && assetState.asset) {
            return {
                id: assetState.asset.id
            };
        } else {
            return {
                external_id: assetState.externalIdToUse
            };
        }
    }).html;

    return richTextHtml;
}
