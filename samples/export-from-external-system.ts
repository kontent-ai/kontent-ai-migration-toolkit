import { IMigrationAsset, IMigrationItem, getDefaultLogAsync, IExportAdapter, exportAsync } from '../lib/index.js';

/* Typically you query your external system to create the migration items & assets */
const exportAdapter: IExportAdapter = {
    name: 'customExportAdapter',
    exportAsync: async () => {
        const migrationItems: IMigrationItem[] = [
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
                        type: 'text',
                        value: 'My article'
                    },
                    {
                        // the codename of the element must match codename of the element in your target K.ai environment
                        codename: 'summary',
                        type: 'rich_text',
                        value: '<p>My article summary</p>'
                    }
                ]
            }
        ];

        const migrationAssets: IMigrationAsset[] = [
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

/*
This will create items.json & assets.zip files within current folder
Once exported, you can use import CLI (or importToolkit in code) to import data to a specified Kontent.ai environment
*/
await exportAsync({
    items: {
        filename: 'items.json',
        formatService: 'json'
    },
    assets: {
        filename: 'assets.zip',
        formatService: 'json'
    },
    log: await getDefaultLogAsync(),
    adapter: exportAdapter
});
