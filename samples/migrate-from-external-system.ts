import {
    MigrationAsset,
    MigrationItem,
    storeAsync,
    elementsBuilder,
    MigrationElements,
    MigrationElementModels,
    importAsync
} from '../lib/index.js';

/**
 * Optionally (but strongly recommended) you may define a migration model
 * representing the content type you are trying to migrate into
 */
interface ArticleElements extends MigrationElements {
    title: MigrationElementModels.TextElement;
    rating: MigrationElementModels.NumberElement;
    related_pages: MigrationElementModels.LinkedItemsElement;
    teaser_image: MigrationElementModels.AssetElement;
}

/**
 * Typically you query your external system to create the migration items & assets
 * */
const migrationItem: MigrationItem<ArticleElements> = {
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
            codename: 'en_uk'
        },
        type: {
            // type codename must match the content type codename in your target K.ai environment
            codename: 'article'
        }
    },
    elements: {
        title: elementsBuilder().textElement({ value: 'Title of the article' }),
        rating: elementsBuilder().numberElement({ value: 5 }),
        related_pages: elementsBuilder().linkedItemsElement({
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
        teaser_image: elementsBuilder().assetElement({ value: [{ codename: 'article_teaser' }] })
    }
};

const migrationAsset: MigrationAsset = {
    // _zipFilename is a name of the file within the export .zip package. It is used only for identifying the file within export
    _zipFilename: 'article_teaser.jpg',
    // codename of the asset - Used for validating whether asset exists in target env
    codename: 'article_teaser',
    // filename will be used in K.ai asset as a filename
    filename: 'article_teaser.jpg',
    // title will be used in K.ai asset as a title
    title: 'Article teaser',
    // binary data of the asset you want to upload
    binaryData: undefined,
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
