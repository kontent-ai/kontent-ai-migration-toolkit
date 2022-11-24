# Kontent.ai CSV Manager

The purpose of this project is to export & import content data to & from [Kontent.ai](https://kontent.ai) projects. This
project uses `Delivery API` for fast import and conversion to CSV and `Management API` to import data back.

This library can be used in `node.js` only - the API cannot be used in directly in browsers.

## How it works

> When importing it is absolutely essential that both `source` and `target` project have identical definitions of
> Content types, taxonomies and workflows. Any inconsistency in data definition may cause import to fail.

**How are content items imported?** The CSV manager creates content items that are not present in target project. If the
content item is already present in the project (based on item's `codename`) the item will get updated or skipped.

**How are langauge variants imported?** Same as with content items, CSV manager either creates or updates language
variants based on their codename & codename of the language.

**How are langauge variants imported?** If asset with it's id or external_id exists in target project, the asset upload
will be skipped and not uploaded at all. If it doesn't exist, the asset from the zip folder will be uploaded and it's id
will be used as a filename. The CSV Manager will also set `external_id` of newly uploaded assets to equal their original
id.

## Installation

Install package globally:

`npm i todo -g`

## Use via CLI

### Configuration

| Config          | Value                                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **projectId**   | Id of Kontent.ai project **(required)**                                                                                       |
| **apiKey**      | Content management Api key **(required for import, not needed for export)**                                                   |
| **action**      | Action. Possible values are: `restore` & `backup` **(required)**                                                              |
| zipFilename     | Name of zip used for export / restoring data. (e.g. 'kontent-backup').                                                        |
| baseUrl         | Custom base URL for Management API calls.                                                                                     |
| exportAssets    | Indicates if assets should be exported. Supported are `true` & `false`                                                        |
| exportTypes     | Array of content types codenames of which content items should be exported. By default all items of all types are exported    |
| skipFailedItems | Indicates if failed content items & language variants should be skipped if their import fails. Supported are `true` & `false` |

### Execution

> We do not recommend importing data back to your production environment directly. Instead, we recommend that you create
> a new environment based on your production one and test the import there first. If the import completes successfully,
> you may swap environments or run it again on the production since you have previously tested it on practically
> identical environment.

To backup a project run:

`csvm --action=backup --projectId=xxx`

To restore a project run:

`csvm --action=restore --apiKey=xxx --projectId=xxx --zipFilename=backupFile`

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
import { ExportService, ImportService, FileProcessorService } from '@kontent-ai/backup-manager';
import { FileService } from '@kontent-ai/backup-manager/dist/cjs/lib/node';

const run = async () => {
    const exportService = new ExportService({
        projectId: 'sourceProjectId',
        filename: 'mybackup.zip', // name of the zip
        exportTypes: [], // array of type codenames to export. If not provided, all items of all types are exported
        exportAssets: true, // indicates whether asset binaries should be exported
        onProcess: (item) => {
            // called when any content is exported
            console.log(`Exported: ${item.title} | ${item.type}`);
        }
    });

    // data contains entire project content
    const data = await exportService.exportAllAsync();

    // you can also save backup in file with FileProcessorService
    const fileProcessorService = new FileProcessorService({
        context: 'node.js' // or 'browser' depending on where your code is executed
    });

    // prepare zip data
    const zipData = await fileProcessorService.createZipAsync(data);

    const fileService = new FileService({});

    // create file on FS
    await fileService.writeFileAsync('backup', zipData);
};

run();
```

### Restore in code

```typescript
import { ExportService, ImportService, FileProcessorService } from '@kontent-ai/backup-manager';
import { FileService } from '@kontent-ai/backup-manager/dist/cjs/lib/node';

const run = async () => {
    const fileService = new FileService({});

    // load file
    const zipFile = await fileService.loadFileAsync('backup');

    const fileProcessorService = new FileProcessorService({
        context: 'node.js' // or 'browser'
    });

    const importService = new ImportService({
        projectId: 'targetProjectId',
        apiKey: 'targetProjectId',
        skipFailedItems: true, // indicates if failed items should be skipped or if program should stop
        onProcess: (item) => {
            // called when any content is processed
            console.log(`Imported: ${item.title} | ${item.type}`);
        },
        canImport: {
            contentItem: (item) => {
                return true; // true if item should be imported, false otherwise
            },
            asset: (asset) => {
                return true; // true if asset should be imported, false otherwise
            }
        },
    });

    // read export data from zip
    const importData = await zipService.extractZipAsync(zipFile);

    // restore into target project
    await importService.importFromSourceAsync(importData);
};

run();
```

## Limitations

### Export limitations

Export is made with `Delivery API` for speed and efficiency, but this brings some limitations:

-   Assets are exported without their original `filename`. If you import these assets back to a different project, the
    `Asset Id` is used as a filename. However, if you import back to the same project, the asset will not be imported if
    it is already there.

### FAQ

#### I'm getting `Header overflow` exception

The Node.js limits the maximum header size of HTTP requests. In some cases it may be required for you to increase this
limitation to be able to successfully fetch data from Kontent.ai. You can do so by using the `max-http-header-size`
option (https://nodejs.org/api/cli.html#--max-http-header-sizesize)

Example script call:

```
node --max-http-header-size 150000 %USERPROFILE%\AppData\Roaming\npm\node_modules\@kontent-ai\backup-manager\dist\cjs\lib\node\cli\app --action=backup --apiKey=<key> --projectId=<projectId>
```
