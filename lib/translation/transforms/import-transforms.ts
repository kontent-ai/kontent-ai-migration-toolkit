import { LanguageVariantElements, LanguageVariantElementsBuilder, SharedContracts } from '@kontent-ai/management-sdk';
import { MigrationElementTransformData, MigrationElementType, MigrationItem, parseAsMigrationReferencesArray } from '../../core/index.js';
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
            value: parseAsMigrationReferencesArray(data.elementData.value).map((m) => {
                return {
                    codename: m.codename
                };
            })
        });
    },
    asset: (data) => {
        const assetReferences = parseAsMigrationReferencesArray(data.elementData.value)
            .map((reference) => reference.codename)
            .map<Readonly<SharedContracts.IReferenceObjectContract>>((codename) => {
                const assetState = data.importContext.getAssetStateInTargetEnvironment(codename);

                // only reference with external_id if item does not exist in target env
                // API currently only supports referencing assets by ids only, not by codenames
                return {
                    id: assetState.asset ? assetState.asset.id : undefined,
                    external_id: assetState.asset ? undefined : assetState.externalIdToUse
                };
            });

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
            value: data.elementData.value?.toString() ?? ''
        });
    },
    date_time: (data) => {
        return elementsBuilder.dateTimeElement({
            element: {
                codename: data.elementCodename
            },
            value: data.elementData.value?.toString() ?? null,
            display_timezone: data.elementData.display_timezone ?? null
        });
    },
    modular_content: (data) => {
        const linkedItemReferences = parseAsMigrationReferencesArray(data.elementData.value)
            .map((reference) => reference.codename)
            .map<Readonly<SharedContracts.IReferenceObjectContract>>((codename) => {
                const itemState = data.importContext.getItemStateInTargetEnvironment(codename);

                // only reference with external_id if item does not exist in target env
                return {
                    codename: itemState.item ? itemState.item.codename : undefined,
                    external_id: itemState.item ? undefined : itemState.externalIdToUse
                };
            });

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
            value: parseAsMigrationReferencesArray(data.elementData.value).map((m) => {
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
            value: data.elementData.value ? +data.elementData.value : null
        });
    },
    rich_text: (data) => {
        return elementsBuilder.richTextElement({
            element: {
                codename: data.elementCodename
            },
            components: mapComponents({
                importContext: data.importContext,
                migrationItems: data.migrationItems,
                elementData: data.elementData
            }),
            value:
                processImportRichTextHtmlValue({
                    elementData: data.elementData,
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
            value: parseAsMigrationReferencesArray(data.elementData.value).map((m) => {
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
            value: data.elementData.value?.toString() ?? null
        });
    },
    url_slug: (data) => {
        return elementsBuilder.urlSlugElement({
            element: {
                codename: data.elementCodename
            },
            value: data.elementData.value?.toString() ?? '',
            mode: data.elementData.mode ?? 'autogenerated'
        });
    }
};

function mapComponents(data: {
    readonly elementData: MigrationElementTransformData;
    readonly importContext: ImportContext;
    readonly migrationItems: readonly MigrationItem[];
}): LanguageVariantElements.IRichTextComponent[] {
    return (data.elementData.components ?? []).map((component) => {
        const mappedComponent: Readonly<LanguageVariantElements.IRichTextComponent> = {
            id: component.system.id,
            type: {
                codename: component.system.type.codename
            },
            elements: Object.entries(component.elements).map(([key, element]) => {
                const transformedElementValue = importTransforms[element.type]({
                    elementCodename: key,
                    importContext: data.importContext,
                    migrationItems: data.migrationItems,
                    elementData: element
                });

                return transformedElementValue;
            })
        };

        return mappedComponent;
    });
}

function processImportRichTextHtmlValue(data: {
    readonly elementData: MigrationElementTransformData;
    readonly importContext: ImportContext;
    readonly migrationItems: readonly MigrationItem[];
}): string | undefined {
    if (!data.elementData) {
        return undefined;
    }

    let richTextHtml: string = data.elementData.value?.toString() ?? '';

    // replace item codenames with existing codename or external_id
    richTextHtml = richTextProcessor().processItemCodenames(richTextHtml, (codename) => {
        return data.importContext.getItemStateInTargetEnvironment(codename);
    }).html;

    // replace link item codenames with existing codename or external_id
    richTextHtml = richTextProcessor().processLinkItemCodenames(richTextHtml, (codename) => {
        return data.importContext.getItemStateInTargetEnvironment(codename);
    }).html;

    // replace asset codenames with existing codename or external_id
    richTextHtml = richTextProcessor().processAssetCodenames(richTextHtml, (codename) => {
        return data.importContext.getAssetStateInTargetEnvironment(codename);
    }).html;

    // replace link asset codenames with existing codename or external_id
    richTextHtml = richTextProcessor().processLinkAssetCodenames(richTextHtml, (codename) => {
        return data.importContext.getAssetStateInTargetEnvironment(codename);
    }).html;

    return richTextHtml;
}
