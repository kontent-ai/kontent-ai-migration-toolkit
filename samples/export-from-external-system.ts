import { MigrationAsset, MigrationItem, ExportAdapter, exportAsync, storeAsync } from '../lib/index.js';

/* Typically you query your external system to create the migration items & assets */
const adapter: ExportAdapter = {
    name: 'customExportAdapter',
    exportAsync: async () => {
        const migrationItems: MigrationItem[] = [
            {
                system: {
                    codename: 'myArticle',
                    // collection codename must match the collection in your target K.ai environment
                    collection: 'default',
                    // language codename must match the language in your target K.ai environment
                    language: 'default',
                    // type codename must match the content type codename in your target K.ai environment
                    type: 'article',
                    name: 'My article'
                },
                elements: [
                    {
                        // the codename of the element must match codename of the element in your target K.ai environment
                        // In this example it is expected that the target environment contains content type with codename 'article' that contains an element with codename 'title' that is of 'text' type
                        codename: 'title',
                        value: 'My article'
                    },
                    {
                        // the codename of the element must match codename of the element in your target K.ai environment
                        codename: 'summary',
                        value: '<p>My article summary</p>'
                    }
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
                // external id of the asset (optional)
                externalId: 'uniqueFileId',
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
