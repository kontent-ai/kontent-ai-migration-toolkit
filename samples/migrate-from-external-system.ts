import {
    MigrationAsset,
    MigrationItem,
    storeAsync,
    elementsBuilder,
    MigrationElementModels,
    importAsync,
    FileBinaryData,
    MigrationItemSystem
} from '../lib/index.js';

/**
 * Optionally (but highly recommended) you may define a migration model
 * representing the environment you are trying to migrate into.
 */
type LanguageCodenames = 'default' | 'en';
type ContentTypeCodenames = 'article' | 'author';
type CollectionCodenames = 'default' | 'global';
type WorkflowCodenames = 'default' | 'custom';
type WorkflowStepCodenames = 'published' | 'archived' | 'draft';
type System = MigrationItemSystem<LanguageCodenames, ContentTypeCodenames, CollectionCodenames, WorkflowCodenames>;

type ArticleItem = MigrationItem<
    {
        title: MigrationElementModels.TextElement;
        rating: MigrationElementModels.NumberElement;
        related_pages: MigrationElementModels.LinkedItemsElement;
        teaser_image: MigrationElementModels.AssetElement;
    },
    System,
    WorkflowStepCodenames
>;

/**
 * Typically you query your external system to create the migration items & assets
 * */
const migrationItem: ArticleItem = {
    system: {
        name: 'My article',
        // codename is primary identifier - also used for validating whether asset exists in target env
        codename: 'myArticle',
        collection: {
            // collection codename must match the collection in your target K.ai environment
            codename: 'default'
        },
        language: {
            // language codename must match the language in your target K.ai environment
            codename: 'en'
        },
        type: {
            // type codename must match the content type codename in your target K.ai environment
            codename: 'article'
        },
        workflow: {
            codename: 'default'
        }
    },
    versions: [
        {
            workflow_step: {
                codename: 'published'
            },
            elements: {
                title: elementsBuilder.textElement({ value: 'Title of the article' }),
                rating: elementsBuilder.numberElement({ value: 5 }),
                related_pages: elementsBuilder.linkedItemsElement({
                    value: [
                        {
                            codename: 'pageA'
                        },
                        {
                            codename: 'pageB'
                        }
                    ]
                }),
                // assets are referenced by their codename
                teaser_image: elementsBuilder.assetElement({ value: [{ codename: 'article_teaser' }] })
            }
        }
    ]
};

const migrationAsset: MigrationAsset = {
    // codename of the asset - Used for validating whether asset exists in target env
    codename: 'article_teaser',
    // filename will be used in K.ai asset as a filename
    filename: 'article_teaser.jpg',
    // title will be used in K.ai asset as a title
    title: 'Article teaser',
    // binary data of the asset you want to upload
    binaryData: stringToBinaryData('data'),
    // collection assignment
    collection: {
        codename: 'teasers'
    },
    // description of asset in project languages
    descriptions: [
        {
            description: 'Teaser of the article',
            language: {
                codename: 'en_uk'
            }
        }
    ]
};

// stores data on FS for later use
await storeAsync({
    data: {
        items: [migrationItem],
        assets: [migrationAsset]
    },
    filename: 'data.zip'
});

// and import to Kontent.ai
await importAsync({
    data: {
        items: [migrationItem],
        assets: [migrationAsset]
    },
    apiKey: '<apiKey>',
    environmentId: '<envId>'
});

function stringToBinaryData(input: string): FileBinaryData {
    return Buffer.from(input);
}
