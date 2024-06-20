import { SharedContracts, LanguageVariantElementsBuilder, LanguageVariantElements } from '@kontent-ai/management-sdk';
import {
    parseAsMigrationReferencesArray,
    MigrationElementType,
    MigrationRichTextElementValue,
    MigrationItem,
    MigrationUrlSlugElementValue
} from '../../core/index.js';
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
        const assetReferences = parseAsMigrationReferencesArray(data.value).reduce<
            SharedContracts.IReferenceObjectContract[]
        >((references, value) => {
            // check if asset already exists in target env
            const assetStateInTargetEnv = data.importContext.getAssetStateInTargetEnvironment(value.codename);

            if (assetStateInTargetEnv.state === 'exists' && assetStateInTargetEnv.asset) {
                // asset exists, use its id as a reference
                // (API currently only supports referencing assets by ids only, not by codenames)
                references.push({
                    id: assetStateInTargetEnv.asset.id
                });
            } else {
                // reference it via external id otherwise
                references.push({
                    external_id: assetStateInTargetEnv.externalIdToUse
                });
            }

            return references;
        }, []);

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
        const linkedItemReferences = parseAsMigrationReferencesArray(data.value).reduce<
            SharedContracts.IReferenceObjectContract[]
        >((references, value) => {
            const itemState = data.importContext.getItemStateInTargetEnvironment(value.codename);

            if (itemState.item) {
                // linked item already exists in target environment
                references.push({
                    codename: itemState.itemCodename
                });
            } else {
                // linked item is new, reference it with external id
                references.push({
                    external_id: itemState.externalIdToUse
                });
            }

            return references;
        }, []);

        return elementsBuilder.linkedItemsElement({
            element: {
                codename: data.elementCodename
            },
            value: linkedItemReferences
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
        const rteElementValue = data.value as MigrationRichTextElementValue;

        return elementsBuilder.richTextElement({
            element: {
                codename: data.elementCodename
            },
            components: mapComponents({
                importContext: data.importContext,
                migrationItems: data.migrationItems,
                rteValue: rteElementValue
            }),
            value:
                processImportRichTextHtmlValue({
                    element: rteElementValue,
                    importContext: data.importContext,
                    migrationItems: data.migrationItems
                }) ?? null
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
        const urlSlugElementValue = data.value as MigrationUrlSlugElementValue;

        return elementsBuilder.urlSlugElement({
            element: {
                codename: data.elementCodename
            },
            value: urlSlugElementValue.value?.toString() ?? '',
            mode: urlSlugElementValue.mode
        });
    }
};

function mapComponents(data: {
    readonly rteValue: MigrationRichTextElementValue;
    readonly importContext: ImportContext;
    readonly migrationItems: MigrationItem[];
}): LanguageVariantElements.IRichTextComponent[] {
    return data.rteValue.components.map((component) => {
        const mappedComponent: LanguageVariantElements.IRichTextComponent = {
            id: component.system.id,
            type: {
                codename: component.system.type.codename
            },
            elements: Object.entries(component.elements).map(([key, element]) => {
                const transformedElementValue = importTransforms[element.type]({
                    elementCodename: key,
                    importContext: data.importContext,
                    migrationItems: data.migrationItems,
                    value: element.value
                });

                return transformedElementValue;
            })
        };

        return mappedComponent;
    });
}

function processImportRichTextHtmlValue(data: {
    readonly element: MigrationRichTextElementValue;
    readonly importContext: ImportContext;
    readonly migrationItems: MigrationItem[];
}): string | undefined {
    if (!data.element) {
        return undefined;
    }

    let richTextHtml: string = data.element.value ?? '';

    // replace item codenames with id or external_id
    richTextHtml = richTextProcessor().processRteItemCodenames(richTextHtml, (codename) => {
        const itemState = data.importContext.getItemStateInTargetEnvironment(codename);

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
        const itemState = data.importContext.getItemStateInTargetEnvironment(codename);

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
        const assetState = data.importContext.getAssetStateInTargetEnvironment(codename);

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
