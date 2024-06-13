import {
    MigrationAsset,
    MigrationItem,
    ExportAdapter,
    exportAsync,
    storeAsync,
    elementsBuilder,
    MigrationElements,
    MigrationElementModels
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
const adapter: ExportAdapter = {
    name: 'customExportAdapter',
    exportAsync: async () => {
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
                teaser_image: elementsBuilder().assetElement({ value: [{ codename: 'article_teaser' }] })
            }
        };

        const migrationAsset: MigrationAsset = {
            // _zipFilename is a name of the file within the export .zip package. It is used only for identifying the file within export
            _zipFilename: 'my_file.txt',
            // codename of the asset - also used for validating whether asset exists in target env
            codename: 'my_file',
            // filename will be used in K.ai asset as a filename
            filename: 'filename.txt',
            // title will be used in K.ai asset as a title
            title: 'My file',
            // binary data of the asset you want to upload
            binaryData: Buffer.from('myFile', 'utf8'),
            // collection assignment
            collection: {
                codename: 'collectionCodename'
            },
            // description of asset in project languages
            descriptions: [
                {
                    description: 'description of asset',
                    language: {
                        codename: 'default'
                    }
                }
            ]
        };

        return {
            items: [migrationItem],
            assets: [migrationAsset]
        };
    }
};

// get data in proper format
const exportData = await exportAsync(adapter);

// stores data on FS for later use
await storeAsync({
    data: exportData,
    files: {
        items: {
            filename: 'items-export.zip',
            format: 'json'
        },
        assets: {
            filename: 'assets-export.zip',
            format: 'json'
        }
    }
});
