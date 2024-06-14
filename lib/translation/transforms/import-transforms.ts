import { SharedContracts, LanguageVariantElementsBuilder } from '@kontent-ai/management-sdk';
import { parseAsMigrationReferencesArray, MigrationElementType, MigrationReference } from '../../core/index.js';
import { ImportContext, ImportTransformFunc } from '../../import/index.js';
import { richTextProcessor } from '../helpers/rich-text.processor.js';

const elementsBuilder = new LanguageVariantElementsBuilder();

/**
 * The purpose of import transform is to take the exported value and convert it to a value that
 * Kontent.ai Management API understands
 */
export const importTransforms: Readonly<Record<MigrationElementType, ImportTransformFunc>> = {
    subpages: (data) => {
        return elementsBuilder.linkedItemsElement({
            element: {
                codename: data.elementCodename
            },
            value: parseAsMigrationReferencesArray(data.value).map((m) => {
                return {
                    codename: m.codename
                };
            })
        });
    },
    asset: (data) => {
        const assetReferences: SharedContracts.IReferenceObjectContract[] = [];

        for (const assetReference of parseAsMigrationReferencesArray(data.value)) {
            // check if asset already exists in target env
            const assetStateInTargetEnv = data.importContext.getAssetStateInTargetEnvironment(assetReference.codename);

            if (assetStateInTargetEnv.state === 'exists' && assetStateInTargetEnv.asset) {
                // asset exists, use its id as a reference
                // (API currently only supports referencing assets by ids only, not by codenames)
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
    custom: (data) => {
        return elementsBuilder.customElement({
            element: {
                codename: data.elementCodename
            },
            value: data.value?.toString() ?? ''
        });
    },
    date_time: (data) => {
        return elementsBuilder.dateTimeElement({
            element: {
                codename: data.elementCodename
            },
            value: data.value?.toString() ?? null
        });
    },
    modular_content: (data) => {
        const value: SharedContracts.IReferenceObjectContract[] = [];
        const linkedItemReferences: MigrationReference[] = parseAsMigrationReferencesArray(data.value);

        for (const linkedItemReference of linkedItemReferences) {
            const itemState = data.importContext.getItemStateInTargetEnvironment(linkedItemReference.codename);

            if (itemState.item) {
                // linked item already exists in target environment
                value.push({
                    codename: itemState.itemCodename
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
    multiple_choice: (data) => {
        return elementsBuilder.multipleChoiceElement({
            element: {
                codename: data.elementCodename
            },
            value: parseAsMigrationReferencesArray(data.value).map((m) => {
                return {
                    codename: m.codename
                };
            })
        });
    },
    number: (data) => {
        return elementsBuilder.numberElement({
            element: {
                codename: data.elementCodename
            },
            value: data.value ? +data.value : null
        });
    },
    rich_text: (data) => {
        const rteHtml = processImportRichTextHtmlValue(data.value?.toString(), data.importContext);

        return elementsBuilder.richTextElement({
            element: {
                codename: data.elementCodename
            },
            value: rteHtml ?? null
        });
    },
    taxonomy: (data) => {
        return elementsBuilder.taxonomyElement({
            element: {
                codename: data.elementCodename
            },
            value: parseAsMigrationReferencesArray(data.value).map((m) => {
                return {
                    codename: m.codename
                };
            })
        });
    },
    text: (data) => {
        return elementsBuilder.textElement({
            element: {
                codename: data.elementCodename
            },
            value: data.value?.toString() ?? null
        });
    },
    url_slug: (data) => {
        return elementsBuilder.urlSlugElement({
            element: {
                codename: data.elementCodename
            },
            value: data.value?.toString() ?? '',
            mode: 'custom'
        });
    }
};

function processImportRichTextHtmlValue(
    richTextHtml: string | undefined,
    importContext: ImportContext
): string | undefined {
    if (!richTextHtml) {
        return richTextHtml;
    }

    // replace item codenames with id or external_id
    richTextHtml = richTextProcessor().processRteItemCodenames(richTextHtml, (codename) => {
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
    richTextHtml = richTextProcessor().processRteLinkItemCodenames(richTextHtml, (codename) => {
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
    richTextHtml = richTextProcessor().processRteAssetCodenames(richTextHtml, (codename) => {
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
