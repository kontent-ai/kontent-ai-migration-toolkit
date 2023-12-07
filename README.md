# Kontent.ai Migration Toolkit

The purpose of this project is to import content data to [Kontent.ai](https://kontent.ai) projects using various
formats.

Data is exported via `Delivery Api` and imported back via `Management Api`. There are 3 default formats for data:
`json`, `jsonJoined` and `csv`. It is possible to write custom transformer if you need to add some extra processing or
use different format all together.

Additionally, content data can also be quickly exported using the `Delivery Api`.

This library can only be used in `node.js`. Use in Browsers is not supported.

## How it works

> When importing it is imported that that both `source` and `target` project have identical definitions of:
> `Content types`, `taxonomies` and `workflows`. Any inconsistency in data definition may cause import to fail.

### How are content items imported?

The Migration Toolkit creates content items that are not present in target project. If the content item exists in target
project (based on item `codename`) the item will be updated. The workflow or published state will be set according to
the source data.

### How are assets imported?

If asset exists in target project, the asset upload will be skipped and not uploaded at all. If asset doesn't exist, the
asset from the zip folder will be uploaded. The Migration Toolkit will also set `external_id` of newly uploaded assets to equal their
original id. There are some limitations to importing assets, see *Limitations* sections for more info.

## Installation

Install package globally:

`npm i xeno-test -g`

## Use via CLI

### Configuration

| Config               | Value                                                                                                                                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **environmentId**    | Id of Kontent.ai project **(required)**                                                                                                                                                                         |
| **managementApiKey** | Management API key **(required for import, optional export)**                                                                                                                                                   |
| **action**           | Action. Available options: `import` & `export` **(required)**                                                                                                                                                   |
| **format**           | Format used to export data. Available options: `csv`, `json` and `jsonJoined` **(required)**                                                                                                                    |
| secureApiKey         | API key for secure Access                                                                                                                                                                                       |
| previewApiKey        | API key for preview                                                                                                                                                                                             |
| isSecure             | When set to `true`, Secure API will be used to make data export. Defaults to `false`                                                                                                                            |
| isPreview            | When set to `true`, Preview API will be used to make data export. Defaults to `false`                                                                                                                           |
| exportAssets         | When set to `true`, Binary data of assets is exported. Defaults to `false`                                                                                                                                      |
| importAssets         | When set to `true`, assets & binary files will be imported. This requires the asset's zip file (can be created with export action). Defaults to `false`                                                         |
| replaceInvalidLinks  | RTE may contain links to invalid items. You won't be able to re-import such items due to validation error. By setting this to `true` the Migration Toolkit will automatically remove these links. Defaults to `false` |
| itemsFilename        | Name of zip used for export / import items                                                                                                                                                                      |
| assetsFilename       | Name of zip used for export / import assets                                                                                                                                                                     |
| baseUrl              | Custom base URL for Management API calls.                                                                                                                                                                       |
| exportTypes          | Array of content types codenames of which content items should be exported. By default all items of all types are exported                                                                                      |
| skipFailedItems      | Indicates if failed content items & language variants should be skipped if their import fails. Available options: `true` & `false`. Detaults to `false`                                                         |

### Execution

> We do not recommend importing data back to your production environment directly. Instead, we recommend that you create
> a new environment based on your production and test the import first. If the import completes successfully, you may
> swap environments or run it again on the production.

Export without assets:

`kdm --action=export --environmentId=xxx --format=csv`

Export with assets:

`kdm --action=export --environmentId=xxx --format=csv --exportAssets=false`

Import without assets:

`kdm --action=import --apiKey=xxx --environmentId=xxx`

Import with assets:

`kdm --action=import --apiKey=xxx --environmentId=xxx --importAssets=true`

Import from json file:

`kdm --action=import --apiKey=xxx --environmentId=xxx --itemsFilename=data.json`

Import from csv file:

`kdm --action=import --apiKey=xxx --environmentId=xxx --itemsFilename=data.csv`

To get some help you can use:

`kdm --help`

### Use with config file

Create a `json` configuration file in the folder where you are attempting to run script. (e.g. `export-config.json`)

```json
{
    "environmentId": "x",
    "secureApiKey": "y",
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

## Use via code

See https://github.com/Enngage/kontent-ai-migration-toolkit/tree/main/samples for examples of how to run this library in
code rather then via command line.

## Customizing exported items

You may customize what items get exported by using the `customItemsExport` option when exporting in code. This option
allows you to export exactly the items you need, however be aware that the exported items may reference other items that
you might not export and subsequent re-import may fail because of the fact that there are missing items.

Example:

```typescript
const exportService = new ExportService({
    environmentId: '<id>',
    exportAssets: true,
    isPreview: false,
    isSecure: false,
    customItemsExport: async (client) => {
        // return only the items you want to export by applying filters, parameters etc..
        const response = await client.items().equalsFilter('elements.category', 'scifi').toAllPromise();
        return response.data.items;
    }
});
```

## Using custom formats

This library provides `csv` and `json` export / import formats out of the box. However, you might want to use different
format or otherwise change how items are processed. For example, you can use this to export into your own `xliff`
format, `xlxs`, some custom `txt` format and so on. By implementing `IFormatService` you can do just that. You may
inspire from these services:

| Service                    | Link                                                                                                                             |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| CSV `IItemFormatService `  | https://github.com/Enngage/kontent-ai-migration-toolkit/blob/main/lib/file-processor/item-formats/item-csv-processor.service.ts  |
| JSON `IItemFormatService ` | https://github.com/Enngage/kontent-ai-migration-toolkit/blob/main/lib/file-processor/item-formats/item-json-processor.service.ts |

To use your custom formatting service simply pass it to `createZipAsync` or `extractZipAsync`

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
