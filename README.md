# Kontent.ai Data Manager

The purpose of this project is to export & import content data to & from [Kontent.ai](https://kontent.ai) projects. This
project uses `Delivery API` for fast import and conversion to various formats (`json` | `csv`) and `Management API` to
import data back.

This library can be used in `node.js` only. Use in Browsers is not supported.

## How it works

> When importing it is absolutely essential that both `source` and `target` project have identical definitions of
> Content types, taxonomies and workflows. Any inconsistency in data definition may cause import to fail.

**How are content items imported?** The Data manager creates content items that are not present in target project. If
the content item is already present in the project (based on item's `codename`) the item will be updated if necessary or
skipped. Content item is only updated if the `name` of the item changes.

**How are langauge variants imported?** Same as with content items, Data manager either creates or updates language
variants based on their codename & codename of the language. Workflow of the language variant is set based on the
`workflow` field in the source data.

**How are assets imported?** If asset with it's id or external_id exists in target project, the asset upload will be
skipped and not uploaded at all. If it doesn't exist, the asset from the zip folder will be uploaded and it's id will be
used as a filename. The Data Manager will also set `external_id` of newly uploaded assets to equal their original id. If
you enable `fetchAssetDetails` option the original filename of the asset will be preserved.

## Installation

Install package globally:

`npm i xeno-test -g`

## Use via CLI

### Configuration

| Config            | Value                                                                                                                                                                                                                         |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **projectId**     | Id of Kontent.ai project **(required)**                                                                                                                                                                                       |
| **apiKey**        | Content management Api key **(required for import, not needed for export)**                                                                                                                                                   |
| **action**        | Action. Available options: `restore` & `backup` **(required)**                                                                                                                                                                |
| format            | Format used to export data. Available options: `csv` & `json`                                                                                                                                                                 |
| previewApiKey     | When set, Preview API will be used to make data export                                                                                                                                                                        |
| secureApiKey      | When set, Secure API will be used to make data export                                                                                                                                                                         |
| filename          | Name of zip used for export / restoring data. (e.g. 'kontent-backup.zip'). When restoring data you may also use individual `*.csv` file.                                                                                      |
| baseUrl           | Custom base URL for Management API calls.                                                                                                                                                                                     |
| exportAssets      | Indicates if assets should be exported. Available options: `true` & `false`                                                                                                                                                   |
| exportTypes       | Array of content types codenames of which content items should be exported. By default all items of all types are exported                                                                                                    |
| skipFailedItems   | Indicates if failed content items & language variants should be skipped if their import fails. Available options: `true` & `false`                                                                                            |
| fetchAssetDetails | Indicates if asset details should be fetched when making data export. If you enable this option, you also must use provide `apiKey` because fetching asset data relies on Management API. Available options: `true` & `false` |

### Execution

> We do not recommend importing data back to your production environment directly. Instead, we recommend that you create
> a new environment based on your production one and test the import there first. If the import completes successfully,
> you may swap environments or run it again on the production since you have previously tested it on practically
> identical environment.

To backup data use:

`kdm --action=backup --projectId=xxx`

To restore data use:

`kdm --action=restore --apiKey=xxx --projectId=xxx --filename=backup.zip|data.csv|data.json`

To get some help you can use:

`kdm --help`

### Use with config file

Create a `json` configuration file in the folder where you are attempting to run script. (e.g. `backup-config.json`)

```json
{
    "projectId": "xxx",
    "filename": "csv-backup",
    "format": "csv",
    "action": "backup",
    "baseUrl": null,
    "exportTypes": null,
    "exportAssets": null
}
```

To execute your action run:

`kdm --config=backup-config.json`

## Use via code

### Backup in code

```typescript
import { ExportService, ImportService, FileProcessorService } from 'xeno-test';
import { FileService } from 'xeno-test/dist/cjs/lib/node';

const run = async () => {
    // prepare services
    const fileProcessorService = new FileProcessorService();
    const fileService = new FileService();

    const exportService = new ExportService({
        projectId: 'sourceProjectId',
        format: 'json', // or csv
        filename: 'mybackup.zip', // name of the zip
        exportTypes: [], // array of type codenames to export. If not provided, all items of all types are exported
        exportAssets: true // indicates whether asset binaries should be exported
    });

    // export data
    const data = await exportService.exportAllAsync();

    // prepare zip
    const zipData = await fileProcessorService.createZipAsync(data, { formatService: new JsonProcessorService() }); // or 'CsvProcessorService' or custom service

    // create file on FS
    await fileService.writeFileAsync('backup', zipData);
};

run();
```

### Restore in code

```typescript
import { ExportService, ImportService, FileProcessorService } from 'xeno-test';
import { FileService } from 'xeno-test/dist/cjs/lib/node';

const run = async () => {
    // prepare services
    const fileService = new FileService();
    const fileProcessorService = new FileProcessorService();

    const importService = new ImportService({
        projectId: 'targetProjectId',
        apiKey: 'targetProjectId',
        skipFailedItems: true, // indicates if failed items should be skipped or if program should stop
        canImport: {
            contentItem: (item) => {
                return true; // true if item should be imported, false otherwise
            },
            asset: (asset) => {
                return true; // true if asset should be imported, false otherwise
            }
        }
    });

    // load file
    const zipFile = await fileService.loadFileAsync('backup.zip');

    // read export data from zip
    const importData = await zipService.extractZipAsync(file, {
        formatService: new JsonProcessorService() // or 'CsvProcessorService' or custom service
    });

    // restore into target project
    await importService.importFromSourceAsync(importData);
};

run();
```

## Customizing exported items

You may customize what items get exported by using the `customItemsExport` option when exporting in code. This option
allows you to export exactly the items you need, however be aware that the exported items may reference other items that
you might not export and subsequent re-import may fail because of the fact that there are missing items.

Example:

```typescript
const exportService = new ExportService({
    projectId: 'p',
    apiKey: 'z',
    previewApiKey: 'x',
    secureApiKey: 'y',
    exportAssets: true,
    fetchAssetDetails: false,
    customItemsExport: async (client) => {
        // return only the items you want to export by applying filters, parameters etc..
        const response = await client.items().equalsFilter('elements.title', 'Warrior').toAllPromise();
        return response.data.items;
    }
});
```

## Using custom formats

This library provides `csv` and `json` export / import formats out of the box. However, you might want to use different
format or otherwise change how items are processed. For example, you can use this to export into your own `xliff`
format, `xlxs`, some custom `txt` format and so on. By implementing `IFormatService` you can do just that. You may
inspire from these services:

| Service                          | Link                                                                                                           |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| CSV `IFormatService`             | https://github.com/Enngage/kontent-data-manager/blob/main/lib/file-processor/formats/csv-processor.service.ts  |
| JSON `IFormatService`            | https://github.com/Enngage/kontent-data-manager/blob/main/lib/file-processor/formats/json-processor.service.ts |
| Simplified demo `IFormatService` | https://github.com/Enngage/kontent-data-manager/blob/main/lib/samples/sample-custom-processor.service.ts       |

To use your custom formatting service simply pass it to `createZipAsync` or `extractZipAsync`

```typescript
await fileProcessorService.createZipAsync(response, { formatService: YourService });
await fileProcessorService.extractZipAsync(file, { formatService: YourService });
```

## Limitations

### Export limitations

Export is made with `Delivery API` for speed and efficiency, but this brings some limitations:

-   Assets are exported without their original `filename`. If you import these assets back to a different project, the
    `Asset Id` is used as a filename. However, if you import back to the same project, the asset will not be imported if
    it is already there. You may enable `fetchAssetDetails` option to fetch asset details including filenames using the
    Magement API. If you enable this option you also need to provide `apiKey`

### FAQ

#### I'm getting `Header overflow` exception

The Node.js limits the maximum header size of HTTP requests. In some cases it may be required for you to increase this
limitation to be able to successfully fetch data from Kontent.ai. You can do so by using the `max-http-header-size`
option (https://nodejs.org/api/cli.html#--max-http-header-sizesize)

Example script call:

```
node --max-http-header-size 150000 %USERPROFILE%\AppData\Roaming\npm\node_modules\xeno-test\dist\cjs\lib\node\cli\app --action=backup --apiKey=<key> --projectId=<projectId>
```
