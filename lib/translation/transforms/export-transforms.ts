import { MigrationElementType, MigrationReference } from '../../core/index.js';
import { ContentTypeElements, TaxonomyModels } from '@kontent-ai/management-sdk';
import { ExportTransformFunc, ExportContext } from '../../export/index.js';
import { richTextProcessor } from '../helpers/rich-text.processor.js';

/**
 * Element transforms used by Kontent.ai export adapter
 */
export const exportTransforms: Readonly<Record<MigrationElementType, ExportTransformFunc>> = {
    text: (data) => data.value?.toString(),
    number: (data) => {
        if (!data.value) {
            return undefined;
        }

        if (Array.isArray(data.value)) {
            throw Error(`Expected value to be a number, not array`);
        }

        if (data.value === 0) {
            return 0;
        }

        return +data.value;
    },
    date_time: (data) => data.value?.toString(),
    rich_text: (data) => transformRichTextValue(data.value?.toString(), data.context),
    asset: (data) => {
        if (!data.value) {
            return [];
        }

        if (!Array.isArray(data.value)) {
            throw Error(`Expected value to be an array`);
        }

        // translate asset id to codename
        const assetReferences: MigrationReference[] = [];
        for (const arrayVal of data.value) {
            if (!arrayVal.id) {
                continue;
            }

            const assetState = data.context.getAssetStateInSourceEnvironment(arrayVal.id);

            if (assetState.asset) {
                // reference asset by codename
                assetReferences.push({ codename: assetState.asset.codename });
            } else {
                throw Error(`Missing asset with id '${arrayVal.id}'`);
            }
        }

        return assetReferences;
    },
    taxonomy: (data) => {
        if (!data.value) {
            return [];
        }

        if (!Array.isArray(data.value)) {
            throw Error(`Expected value to be an array`);
        }

        const taxonomyElement = data.typeElement.element as ContentTypeElements.ITaxonomyElement;
        const taxonomyGroupId = taxonomyElement.taxonomy_group.id ?? 'n/a';

        // get taxonomy group
        const taxonomy = data.context.environmentData.taxonomies.find((m) => m.id === taxonomyGroupId);

        if (!taxonomy) {
            throw Error(`Could not find taxonomy group with id '${taxonomyGroupId}'`);
        }

        // translate item id to codename
        const taxonomyReferences: MigrationReference[] = [];
        for (const arrayVal of data.value) {
            if (!arrayVal.id) {
                continue;
            }

            const taxonomyTerm = findTaxonomy(arrayVal.id, taxonomy);

            if (taxonomyTerm) {
                // reference taxonomy term by codename
                taxonomyReferences.push({ codename: taxonomyTerm.codename });
            } else {
                throw Error(`Missing taxonomy term with id '${arrayVal.id}'`);
            }
        }

        return taxonomyReferences;
    },
    modular_content: (data) => {
        if (!data.value) {
            return [];
        }

        if (!Array.isArray(data.value)) {
            throw Error(`Expected value to be an array`);
        }

        // translate item id to codename
        const linkedItemReferences: MigrationReference[] = [];
        for (const arrayVal of data.value) {
            if (!arrayVal.id) {
                continue;
            }

            const itemState = data.context.getItemStateInSourceEnvironment(arrayVal.id);

            if (itemState.item) {
                // reference item by codename
                linkedItemReferences.push({ codename: itemState.item.codename });
            } else {
                throw Error(`Missing item with id '${arrayVal.id}'`);
            }
        }

        return linkedItemReferences;
    },
    custom: (data) => data.value?.toString(),
    url_slug: (data) => data.value?.toString(),
    multiple_choice: (data) => {
        if (!data.value) {
            return [];
        }

        if (!Array.isArray(data.value)) {
            throw Error(`Expected value to be an array`);
        }

        // translate multiple choice option id to codename
        const multipleChoiceElement = data.typeElement.element as ContentTypeElements.IMultipleChoiceElement;
        const choiceOptionReferences: MigrationReference[] = [];

        for (const arrayVal of data.value) {
            if (!arrayVal.id) {
                continue;
            }

            const option = multipleChoiceElement.options.find((m) => m.id === arrayVal.id);

            if (!option?.codename) {
                throw Error(`Could not find multiple choice element with option id '${arrayVal.id}'`);
            }

            choiceOptionReferences.push({ codename: option.codename });
        }

        return choiceOptionReferences;
    },
    subpages: (data) => {
        if (!data.value) {
            return [];
        }
        if (!Array.isArray(data.value)) {
            throw Error(`Expected value to be an array`);
        }

        // translate item id to codename
        const linkedItemReferences: MigrationReference[] = [];
        for (const arrayVal of data.value) {
            if (!arrayVal.id) {
                continue;
            }

            const itemState = data.context.getItemStateInSourceEnvironment(arrayVal.id);

            if (itemState.item) {
                // reference item by codename
                linkedItemReferences.push({ codename: itemState.item.codename });
            } else {
                throw Error(`Missing item with id '${arrayVal.id}'`);
            }
        }

        return linkedItemReferences;
    }
};

function findTaxonomy(termId: string, taxonomy: TaxonomyModels.Taxonomy): TaxonomyModels.Taxonomy | undefined {
    if (taxonomy.id === termId) {
        return taxonomy;
    }

    if (taxonomy.terms) {
        for (const taxonomyTerm of taxonomy.terms) {
            const foundTerm = findTaxonomy(termId, taxonomyTerm);
            if (foundTerm) {
                return foundTerm;
            }
        }
    }

    return undefined;
}

function transformRichTextValue(richTextHtml: string | undefined, context: ExportContext): string | undefined {
    if (!richTextHtml) {
        return richTextHtml;
    }

    // replace item ids with codenames
    richTextHtml = richTextProcessor().processDataIds(richTextHtml, (id) => {
        const itemInEnv = context.getItemStateInSourceEnvironment(id).item;

        if (!itemInEnv) {
            throw Error(`Failed to get item with id '${id}'`);
        }

        return {
            codename: itemInEnv.codename
        };
    }).html;

    // replace link item ids with codenames
    richTextHtml = richTextProcessor().processLinkItemIds(richTextHtml, (id) => {
        const itemInEnv = context.getItemStateInSourceEnvironment(id).item;

        if (!itemInEnv) {
            throw Error(`Failed to get item with id '${id}'`);
        }

        return {
            codename: itemInEnv.codename
        };
    }).html;

    // replace asset ids with codenames
    richTextHtml = richTextProcessor().processAssetIds(richTextHtml, (id) => {
        const assetInEnv = context.getAssetStateInSourceEnvironment(id).asset;

        if (!assetInEnv) {
            throw Error(`Failed to get asset with id '${id}'`);
        }

        return {
            codename: assetInEnv.codename
        };
    }).html;

    return richTextHtml;
}
