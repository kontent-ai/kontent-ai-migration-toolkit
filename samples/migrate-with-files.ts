import {
    ImportToolkit,
    IMigrationAsset,
    IMigrationItem,
    getDefaultLog,
    IExportAdapter,
    ExportToolkit
} from '../lib/index.js';

const customExportAdapter: IExportAdapter = {
    name: 'customExportAdapter',
    exportAsync: async () => {
        // Typically you query your external system to create the migration items & assets
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
                _zipFilename: 'filename.txt',
                // filename will be used in K.ai asset as a filename
                filename: 'filename.txt',
                // title will be used in K.ai asset as a title
                title: 'My file',
                // assetExternalId is optional, but highly recommended as if you would run the import multiple times this prevents
                // upload / creation of duplicate assets
                externalId: 'uniqueFileId',
                // and this is the actual binary data of the asset you want to upload
                binaryData: Buffer.from('myFile', 'utf8')
            }
        ];

        return {
            items: migrationItems,
            assets: migrationAssets
        };
    }
};

const run = async () => {
    const exportToolkit = new ExportToolkit({
        items: {
            filename: 'items.json',
            formatService: 'json'
        },
        assets: {
            filename: 'assets.zip',
            formatService: 'json'
        },
        log: getDefaultLog(),
        adapter: customExportAdapter
    });

    /*
    1) This will create items.json & assets.zip files within current folder
    2) Once exported, you can use import CLI (or importToolkit in code) to import data to a specified Kontent.ai environment
    */
    await exportToolkit.exportAsync();

    const importToolkit = new ImportToolkit({
        environmentId: 'x',
        managementApiKey: 'y',
        skipFailedItems: false,
        sourceType: 'file',
        log: getDefaultLog()
    });

    await importToolkit.importFromFilesAsync({
        items: {
            filename: 'items.json',
            formatService: 'json'
        },
        assets: {
            filename: 'assets.zip',
            formatService: 'json'
        }
    });
};

run();
