[![npm version](https://badge.fury.io/js/%40kontent-ai%2Fbackup-manager.svg)](https://badge.fury.io/js/%40kontent-ai%2Fbackup-manager)
[![Build & Test](https://github.com/kontent-ai/backup-manager-js/actions/workflows/integrate.yml/badge.svg)](https://github.com/kontent-ai/backup-manager-js/actions/workflows/integrate.yml)

# Kontent.ai CSV Manager

The purpose of this project is to export & import content related data to & from [Kontent.ai](https://kontent.ai) projects. This project uses `Delivery API` for fast import and conversion to CSV and `Management API` to import data back. 

When importing it is absolutely essential that both `source` and `target` project contains identical definitions of Content types, taxonomies and workflows. Any inconsistency in data definition may cause import to fail.

## Limitations

### Export limitations

Export is made with `Delivery API` for speed and efficiency, but this brings some limitations:

- Assets are exported without their original `filename`. If you import these assets back to a different project, the `Asset Id` is used as a filename. However, if you import back to the same project, the asset will not be imported if it is already there. 

## Installation

Install package globally:

`npm i todo -g`

## Use via CLI

### Configuration

| Config          | Value                                                                                                               |
|-----------------|---------------------------------------------------------------------------------------------------------------------|
| **projectId**       | Id of Kontent.ai project **(required)**                                                                            |
| **apiKey**           | Content management Api key **(required for import, not needed for export)**                                                                               |
| **action**           | Action. Possible values are: `restore` & `backup` & `clean` **(required)**                                              |
| zipFilename     | Name of zip used for export / restoring data. (e.g. 'kontent-backup').                                            |
| baseUrl           | Custom base URL for Management API calls. |
| exportAssets           | Indicates if assets should be exported. Supported values are `true` & `false` |
| exportTypes           | Array of content types codenames of which content items should be exported. By default all items of all types are exported |

### Execution

> We recommend restoring backups to clean (empty) projects. Restoration process may make changes to target project such as changing language codenames to match source project.

To backup a project run:

`csvm --action=backup --projectId=xxx`

To restore a project run:

`csvm --action=restore --apiKey=xxx --projectId=xxx --zipFilename=backupFile`

To clean (delete) everything inside a project run:

`csvm --action=clean --apiKey=xxx --projectId=xxx`

To get some help you can use:

`csvm --help`

### Use with config file

Create a `json` configuration file in the folder where you are attempting to run script. (e.g. `backup-config.json`)

```json
{
    "projectId": "xxx",
    "zipFilename": "csv-backup",
    "action": "backup",
    "baseUrl": null,
    "exportTypes": null,
    "exportAssets": null
}
```

To execute your action run: 

`csvm --config=backup-config.json`

## Use via code

### Backup in code 

```typescript
import { ExportService, ImportService, ZipService } from "@kontent-ai/backup-manager";
import { FileService } from '@kontent-ai/backup-manager/dist/cjs/lib/node';

const run = async () => {
    const exportService = new ExportService({
        projectId: 'sourceProjectId',
        exportTypes: ['movie'], // array of type codenames to export
        exportAssets: true, // indicates whether asset binaries should be exported 
        onExport: item => {
            // called when any content is exported
            console.log(`Exported: ${item.title} | ${item.type}`);
        }
    });

    // data contains entire project content
    const data = await exportService.exportAllAsync();

    // you can also save backup in file with ZipService
    const zipService = new ZipService({
        context: 'node.js',
    });

    // prepare zip data
    const zipData = await zipService.createZipAsync(data);

    const fileService = new FileService({
    });

    // create file on FS
    await fileService.writeFileAsync('backup', zipData);
};

run();
```

### Restore in code

```typescript
import { ExportService, ImportService, ZipService } from "@kontent-ai/backup-manager";
import { FileService } from '@kontent-ai/backup-manager/dist/cjs/lib/node';

const run = async () => {
    const fileService = new FileService({
    });

    // load file
    const zipFile = await fileService.loadFileAsync('backup');

    const zipService = new ZipService({
        context: 'node.js',
    });

    const importService = new ImportService({
        onImport: item => {
            // called when any content is imported
            console.log(`Imported: ${item.title} | ${item.type}`);
        },
       canImport: {
            asset: (item) => true, // assets will be imported
            contentType: (item) => {
                if (item.codename === 'article') {
                    // content type will be imported only if the codename is equal to 'article'
                    return true;
                }
                // all other types will be excluded from import
                return false;
            },
            assetFolder: item => true, // all folders will be imported
            contentItem: item => true, // all content items will be imported
            contentTypeSnippet: item => true, // all content type snippets will be imported
            language: item => true, // all languages will be imported
            languageVariant: item => true, // all language variants will be imported
            taxonomy: item => true,// all taxonomies will be imported
        },
        preserveWorkflow: true, // when enabled, language variants will preserve their workflow information
        projectId: 'targetProjectId',
        apiKey: 'targetProjectId',
        fixLanguages: true, // backup manager will attempt to create missing languages & map existing languages
        workflowIdForImportedItems: '00000000-0000-0000-0000-000000000000' // id that items are assigned
    });

    // read export data from zip
    const importData = await zipService.extractZipAsync(zipFile);

    // restore into target project
    await importService.importFromSourceAsync(importData);
};

run();
```

### Clean in code

```typescript
const run = async () => {
    const zipService = new ZipService({
        filename: 'xxx',
        context: 'node.js' // 'node.js' or 'browser'
    });

    const cleanService = new CleanService({
        onDelete: item => {
            // called when any content is deleted
            console.log(`Deleted: ${item.title} | ${item.type}`);
        },
        fixLanguages: true,
        projectId: 'targetProjectId',
        apiKey: 'targetProjectId',
    });

    // read export data from zip
    const data = await zipService.extractZipAsync();

    // restore into target project
    await cleanService.importFromSourceAsync(data);
};

run();
```

### FAQ

#### I'm getting `Header overflow` exception

The Node.js limits the maximum header size of HTTP requests. In some cases it may be required for you to increase this limitation to be able to successfully fetch data from Kontent.ai. You can do so by using the `max-http-header-size` option (https://nodejs.org/api/cli.html#--max-http-header-sizesize)

Example script call:

```
node --max-http-header-size 150000 %USERPROFILE%\AppData\Roaming\npm\node_modules\@kontent-ai\backup-manager\dist\cjs\lib\node\cli\app --action=backup --apiKey=<key> --projectId=<projectId>
```