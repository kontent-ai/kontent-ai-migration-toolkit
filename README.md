# Kontent.ai Migration Toolkit

The purpose of this project is to import content data to [Kontent.ai](https://kontent.ai) projects using various formats
and export adapters. Currently we support only `Kontent.ai` export adapter (meaning you can export data from Kontent.ai
and re-import it to the same or different project)

This library can only be used in `node.js`. Use in Browsers is not supported.

### Important Disclaimer

> We do not recommend importing data into your production environment directly (= without proper testing), unless you
> are absolutely sure you know what you are doing. Instead, we recommend that you create a new environment based on your
> production and test the import there first. If the import meets your expectations, you may swap environments or run it again
> on the production.

## How it works

> When importing it is essential that `Content types`, `Taxonomies` and `Workflows` matches the input data. Any
> inconsistency in data such as referencing inexistent taxonomy term, incorrect element type and other problems will
> cause import to fail.

### How are content items imported?

The Migration Toolkit creates content items that are not present in target project. If the content item exists in target
project (based on item `codename`) the item will be updated. The workflow or published state will be set according to
the source data.

### How are assets imported?

If asset exists in target project, the asset upload will be skipped and not uploaded at all. If asset doesn't exist, the
asset from the zip folder will be uploaded. The Migration Toolkit will also set `external_id` of newly uploaded assets
to equal their original id. There are some limitations to importing assets, see _Limitations_ sections for more info.

## Installation

Install package globally:

`npm i xeno-test -g`

## Use via CLI

### Export Configuration

| Config              | Value                                                                                                                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **action**          | Action. Available options: `import` & `export` **(required)**                                                                                                                                                         |
| **environmentId**   | Id of Kontent.ai project **(required)**                                                                                                                                                                               |
| **adapter**         | Adapter used to export data into known format that can be used for importing data. Available options: `kontentAi` **(required for export)**                                                                           |
| **format**          | Format used to export data. Available options: `csv`, `json` and `jsonJoined` **(required for export & import)**                                                                                                      |
| secureApiKey        | API key for secure Access. `isSecure` also needs to be enabled                                                                                                                                                        |
| previewApiKey       | API key for preview. `isPreview` also needs to be enabled                                                                                                                                                             |
| isSecure            | When set to `true`, Secure API will be used to make data export. Defaults to `false`                                                                                                                                  |
| isPreview           | When set to `true`, Preview API will be used to make data export. Defaults to `false`                                                                                                                                 |
| exportAssets        | When set to `true`, Binary data of assets is exported. Defaults to `false`                                                                                                                                            |
| replaceInvalidLinks | RTE may contain links to invalid items. You won't be able to re-import such items due to validation error. By setting this to `true` the Migration Toolkit will automatically remove these links. Defaults to `false` |
| itemsFilename       | Name of the items file that will be created in folder where script is run                                                                                                                                             |
| assetsFilename      | Name of the assets file that will be created in folder where script is run. Only zip is supported.                                                                                                                    |
| baseUrl             | Custom base URL for Kontent.ai API calls                                                                                                                                                                              |

### Import Configuration

| Config               | Value                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **action**           | Action. Available options: `import` & `export` **(required)**                                                                                           |
| **environmentId**    | Id of Kontent.ai project **(required)**                                                                                                                 |
| **managementApiKey** | Management API key **(required)**                                                                                                                       |
| **format**           | Format used to export data. Available options: `csv`, `json` and `jsonJoined` **(required for export & import)**                                        |
| itemsFilename        | Name of the items file that will be used to parse items                                                                                                 |
| assetsFilename       | Name of the items file that will be used to parse assets (only zip supported)                                                                           |
| baseUrl              | Custom base URL for Kontent.ai API calls                                                                                                                |
| skipFailedItems      | Indicates if failed content items & language variants should be skipped if their import fails. Available options: `true` & `false`. Detaults to `false` |

### Import CLI samples

Import from zip:

`kdm --action=import --apiKey=xxx --environmentId=xxx --itemsFilename=data.zip --format=json`

Import from zip with assets:

`kdm --action=import --apiKey=xxx --environmentId=xxx --itemsFilename=data.zip --format=json --assetsFilename=assets.zip`

Import from json file:

`kdm --action=import --apiKey=xxx --environmentId=xxx --itemsFilename=data.json --format=json`

Import from csv file:

`kdm --action=import --apiKey=xxx --environmentId=xxx --itemsFilename=data.csv --format=csv`

### Export CLI samples

Export from Kontent.ai environment as json without assets:

`kdm --action=export --adapter=kontentAi --environmentId=xxx --format=json`

Export from Kontent.ai environment as csv without assets:

`kdm --action=export --adapter=kontentAi --environmentId=xxx --format=csv`

Export from Kontent.ai environment as single json file with assets:

`kdm --action=export --adapter=kontentAi --environmentId=xxx --format=jsonJoined --exportAssets=true`

### CLI help

To see available commands use:

`kdm --help`

### Use with config file

Create a `json` configuration file in the folder where you are attempting to run script. (e.g. `export-config.json`)

```json
{
    "environmentId": "x",
    "secureApiKey": "y",
    "adapter": "kontentAi",
    "isSecure": true,
    "isPreview": false,
    "exportAssets": true,
    "action": "export",
    "baseUrl": null,
    "format": "json"
}
```

To execute your action run:

`kdm --config=export-config.json`

## Use in code

See https://github.com/Enngage/kontent-ai-migration-toolkit/tree/main/samples for examples of how to run this library in
code rather then via command line.

## Importing in code

Example below shows the most basic example of importing `content items` from a single `json` file

```typescript
const importToolkit = new ImportToolkit({
    environmentId: '<id>',
    managementApiKey: '<mapiKey>',
    skipFailedItems: false,
    // be careful when filtering data to import because you might break data consistency.
    // for example, it might not be possible to import language variant without first importing content item and so on.
    canImport: {
        asset: (item) => true, // all assets will be imported
        contentItem: (item) => true // all content items will be imported,
    },
    items: {
        filename: 'items.json',
        formatService: new ItemJsonProcessorService()
    }
});

await importToolkit.importFromFileAsync();
```

## Exporting in code

You may customize what items get exported by using the `customItemsExport` option when exporting in code. This option
allows you to export exactly the items you need, however be aware that the exported items may reference other items that
you might not export and subsequent re-import may fail because of the fact that there are missing items.

Example:

```typescript
const adapter = new KontentAiExportAdapter({
    environmentId: '<id>',
    exportAssets: true,
    isPreview: false,
    isSecure: false,
    // optional filter to customize what items are exported
    customItemsExport: async (client) => {
        // return only the items you want to export by applying filters, parameters etc..
        const response = await client.items().equalsFilter('elements.category', 'scifi').toAllPromise();
        return response.data.items;
    }
});

const exportToolkit = new ExportToolkit({ adapter });

await exportToolkit.exportAsync({
    items: {
        filename: 'items-export.zip',
        formatService: new ItemJsonProcessorService() // or different one, see readme.md
    },
    // assets are optional
    assets: {
        filename: 'assets-export.zip',
        formatService: new AssetJsonProcessorService() // or different one, see readme.md
    }
});
```

## Output / Input formats

This library provides `csv`, `json`, `jsoinJoined` formats out of the box. However, you can create your own format by
implementing `IFormatService` and supplying that to import / export functions. This is useful if you need to extend the
existing format, change how it's processing or just support new formats such as `xliff`, `xlxs`, `xml` or other.

Following is a list of `built-in` format services:

| Type         | Service                           | Link                                                                                                                                    |
| ------------ | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `csv`        | `ItemCsvProcessorService `        | https://github.com/Enngage/kontent-ai-migration-toolkit/blob/main/lib/file-processor/item-formats/item-csv-processor.service.ts         |
| `json`       | `ItemJsonProcessorService `       | https://github.com/Enngage/kontent-ai-migration-toolkit/blob/main/lib/file-processor/item-formats/item-json-processor.service.ts        |
| `jsonJoined` | `ItemJsonJoinedProcessorService ` | https://github.com/Enngage/kontent-ai-migration-toolkit/blob/main/lib/file-processor/item-formats/item-json-joined-processor.service.ts |

### Limitations

Export is made with `Delivery API` for speed and efficiency, but this brings some limitations:

-   Assets are exported without their `title`. If you import these assets back to a different project, the `filename` is
    used as a `title`. Similarly, folder structure of imported assets is not preserved. This only applies when asset is
    actually imported as if the asset already exists in target project, it is skipped from import (this is often the
    case if the export and import environments are one and the same)
-   Language variants in `Scheduled` workflow step are not migrated to this workflow step because the API is missing the
    information about scheduled time so there is no way to specify scheduled publish time

### FAQ

#### I'm getting `Header overflow` exception

The Node.js limits the maximum header size of HTTP requests. In some cases it may be required for you to increase this
limitation to be able to successfully fetch data from Kontent.ai. You can do so by using the `max-http-header-size`
option (https://nodejs.org/api/cli.html#--max-http-header-sizesize)

Example script call:

```
node --max-http-header-size 150000 %USERPROFILE%\AppData\Roaming\npm\node_modules\xeno-test\dist\cjs\lib\node\cli\app --action=export --apiKey=<key> --environmentId=<environmentId>
```
