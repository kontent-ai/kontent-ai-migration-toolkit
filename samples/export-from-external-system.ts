import {
    MigrationAsset,
    MigrationItem,
    ExportAdapter,
    exportAsync,
    storeAsync,
    elementsBuilder
} from '../lib/index.js';



/* Typically you query your external system to create the migration items & assets */
const adapter: ExportAdapter = {
    name: 'customExportAdapter',
    exportAsync: async () => {
        const migrationItems: MigrationItem[] = [
            {
                system: {
                    name: 'My article',
                    codename: 'myArticle', // item identifier - also used for validating whether asset exists in target env
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
                elements: [
                    // use `elementsBuilder` to help you create element values
                    elementsBuilder().textElement({ codename: 'title', value: 'Title of the article' }),
                    elementsBuilder().numberElement({ codename: 'rating', value: 5 }),
                    elementsBuilder().linkedItemsElement({
                        codename: 'related_pages',
                        value: [
                            {
                                codename: 'pageA'
                            },
                            {
                                codename: 'pageB'
                            }
                        ]
                    }),
                    elementsBuilder().assetElement({ codename: 'teaser', value: [{ codename: 'article_teaser' }] })
                ]
            }
        ];

        const migrationAssets: MigrationAsset[] = [
            {
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
            }
        ];

        return {
            items: migrationItems,
            assets: migrationAssets
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
