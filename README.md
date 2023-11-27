# Kontent.ai Data Manager

The purpose of this project is to export & import content data to & from [Kontent.ai](https://kontent.ai) projects.

Data is exported via `Delivery Api` and imported back via `Management Api`. There are 3 default formats for data:
`json`, `jsonSingle` and `csv`. It is possible to write custom transformer if you need to add some extra processing or
use different format all together.

This library can only be used in `node.js`. Use in Browsers is not supported.

## How it works

> When importing it is imported that that both `source` and `target` project have identical definitions of:
> `Content types`, `taxonomies` and `workflows`. Any inconsistency in data definition may cause import to fail.

### How are content items imported?

The Data manager creates content items that are not present in target project. If the content item exists in target
project (based on item's `codename`) the item will be updated. The workflow will be preserved.

### How are assets imported?

If asset exists in target project, the asset upload will be skipped and not uploaded at all. If asset doesn't exist, the
asset from the zip folder will be uploaded and it's id will be used as a filename unless you enable the
`fetchAssetsDetails` option. The data Manager will also set `external_id` of newly uploaded assets to equal their
original id. Folder structure of imported assets is not preserved.

## Installation

Install package globally:

`npm i xeno-test -g`

## Use via CLI

### Configuration

| Config               | Value                                                                                                                                                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **environmentId**    | Id of Kontent.ai project **(required)**                                                                                                                                                                                       |
| **managementApiKey** | Management API key **(required for import, optional export)**                                                                                                                                                                 |
| **action**           | Action. Available options: `restore` & `export` **(required)**                                                                                                                                                                |
| **format**           | Format used to export data. Available options: `csv`, `json` and `jsonSingle` **(required)**                                                                                                                                  |
| secureApiKey         | API key for secure Access                                                                                                                                                                                                     |
| isSecure             | When set to `true`, Secure API will be used to make data export                                                                                                                                                               |
| previewApiKey        | API key for preview                                                                                                                                                                                                           |
| isPreview            | When set to `true`, Preview API will be used to make data export                                                                                                                                                              |
| itemsFilename        | Name of zip used for export / restore items                                                                                                                                                                                   |
| assetsFilename       | Name of zip used for export / restore assets                                                                                                                                                                                  |
| baseUrl              | Custom base URL for Management API calls.                                                                                                                                                                                     |
| exportTypes          | Array of content types codenames of which content items should be exported. By default all items of all types are exported                                                                                                    |
| skipFailedItems      | Indicates if failed content items & language variants should be skipped if their import fails. Available options: `true` & `false`                                                                                            |
| fetchAssetDetails    | Indicates if asset details should be fetched when making data export. If you enable this option, you also must use provide `apiKey` because fetching asset data relies on Management API. Available options: `true` & `false` |

### Execution

> We do not recommend importing data back to your production environment directly. Instead, we recommend that you create
> a new environment based on your production and test the import first. If the import completes successfully, you may
> swap environments or run it again on the production.

Export without assets:

`kdm --action=export --environmentId=xxx --format=csv --itemsFilename=items-export.zip`

Export with assets:

`kdm --action=export --environmentId=xxx --format=csv --itemsFilename=items-export.zip --assetsFilename=assets-export.zip`

Restore without assets:

`kdm --action=restore --apiKey=xxx --environmentId=xxx --itemsFilename=items-export.zip`

Restore with assets:

`kdm --action=restore --apiKey=xxx --environmentId=xxx --itemsFilename=export.zip --assetsFilename=assets-export.zip`

Restore from json file:

`kdm --action=restore --apiKey=xxx --environmentId=xxx --itemsFilename=data.json`

Restore from csv file:

`kdm --action=restore --apiKey=xxx --environmentId=xxx --itemsFilename=data.csv`

To get some help you can use:

`kdm --help`

### Use with config file

Create a `json` configuration file in the folder where you are attempting to run script. (e.g. `export-config.json`)

```json
{
    "environmentId": "xxx",
    "filename": "csv-export",
    "format": "csv",
    "action": "export"
}
```

To execute your action run:

`kdm --config=export-config.json`

## Use via code

See https://github.com/Enngage/kontent-data-manager/tree/main/samples for examples of how to run this library in code
rather then via command line.

## Customizing exported items

You may customize what items get exported by using the `customItemsExport` option when exporting in code. This option
allows you to export exactly the items you need, however be aware that the exported items may reference other items that
you might not export and subsequent re-import may fail because of the fact that there are missing items.

Example:

```typescript
const exportService = new ExportService({
    environmentId: 'x',
    apiKey: 'x',
    exportAssets: true,
    fetchAssetDetails: false,
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

| Service                    | Link                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| CSV `IItemFormatService `  | https://github.com/Enngage/kontent-data-manager/blob/main/lib/file-processor/item-formats/item-csv-processor.service.ts  |
| JSON `IItemFormatService ` | https://github.com/Enngage/kontent-data-manager/blob/main/lib/file-processor/item-formats/item-json-processor.service.ts |

To use your custom formatting service simply pass it to `createZipAsync` or `extractZipAsync`

### Export limitations

Export is made with `Delivery API` for speed and efficiency, but this brings some limitations:

-   Assets are exported without their original `filename`. If you import these assets back to a different project, the
    `Asset Id` is used as a filename. However, if you import back to the same project, the asset will not be imported if
    it is already there. You may enable `fetchAssetDetails` option to fetch asset details including filenames using the
    Management API. If you enable this option you also need to provide `apiKey`

### FAQ

#### I'm getting `Header overflow` exception

The Node.js limits the maximum header size of HTTP requests. In some cases it may be required for you to increase this
limitation to be able to successfully fetch data from Kontent.ai. You can do so by using the `max-http-header-size`
option (https://nodejs.org/api/cli.html#--max-http-header-sizesize)

Example script call:

```
node --max-http-header-size 150000 %USERPROFILE%\AppData\Roaming\npm\node_modules\xeno-test\dist\cjs\lib\node\cli\app --action=export --apiKey=<key> --environmentId=<environmentId>
```
