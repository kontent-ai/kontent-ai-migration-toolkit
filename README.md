# Kontent.ai Migration Toolkit

The purpose of this project is to import content data to [Kontent.ai](https://kontent.ai) projects using various formats
and export adapters. We provide `Kontent.ai` export adapter by default (meaning you can export data from Kontent.ai and
re-import it to the same or different project).

> [!TIP]  
> The idea behind this tool is to help migration of data into `Kontent.ai` from a simple object structure (json, csv..).
> Developers should export data from their system into this format and use this tool to import it. This tool takes care
> of preparing content items, language variants, moving items through workflow, publishing, archiving, uploading assets,
> retry policy and some basic validation and more.

This library can only be used in `node.js`. Use in Browsers is not supported.

# Getting started

We recommend running data-ops with `npx`. Use `--help` anytime to get information about available commands and their
options.

```bash
npx kontent-ai-migration-toolkit --help

# you can also install the package globally, or locally
npm i kontent-ai-migration-toolkit -g

# with the package installed, you can call the tool as follows
kontent-ai-migration-toolkit --help
```

# Import

> [!CAUTION]  
> **We do not recommended importing into a production environment directly** (without proper testing). Instead you
> should first create a testing environment and run the script there to make sure everything works as you intended to.

> [!NOTE]  
> When importing it is essential that used `Content types`, `Taxonomies` and `Workflows` are consistent with the ones
> defined in target environment. Any inconsistency in data such as referencing inexistent taxonomy term, incorrect
> element type and other problems will cause import to fail.

## How are content items & language variants imported?

The Migration Toolkit creates content items that are not present in target project. If the content item exists in target
project (based on item's `codename`) the item will be updated. The workflow of imported language variant will be set
according to `workflowStep` field.

You can run `kontent-ai-migration-toolkit` many times over without being worried that identical content item will be
created multiple times.

## How are assets imported?

If asset exists in target project, the asset upload will be skipped and not uploaded at all. If asset doesn't exist, the
asset from the zip folder will be uploaded. The Migration Toolkit will also set `external_id` of newly uploaded assets
to equal their original id. There are some limitations to importing assets, see _Limitations_ sections for more info.

## Import Configuration

| Config            | Value                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **action**        | Action. Available options: `import` & `export` **(required)**                                                                                           |
| **environmentId** | Id of Kontent.ai project **(required)**                                                                                                                 |
| **apiKey**        | Management API key **(required)**                                                                                                                       |
| **format**        | Format used to export data. Available options: `csv`, `json` and `jsonJoined` **(required)**                                                            |
| itemsFilename     | Name of the items file that will be used to parse items                                                                                                 |
| assetsFilename    | Name of the items file that will be used to parse assets (only zip supported)                                                                           |
| baseUrl           | Custom base URL for Kontent.ai API calls                                                                                                                |
| skipFailedItems   | Indicates if failed content items & language variants should be skipped if their import fails. Available options: `true` & `false`. Detaults to `false` |
| force             | Can be used to disable confirmation prompts. Available options: `true` & `false`. Detaults to `false`                                      |

## Import CLI samples

```bash
# Import from zip:
kontent-ai-migration-toolkit --action=import --apiKey=xxx --environmentId=xxx --itemsFilename=data.zip --format=json

# Import from zip with assets:
kontent-ai-migration-toolkit --action=import --apiKey=xxx --environmentId=xxx --itemsFilename=data.zip --format=json --assetsFilename=assets.zip

# Import from json file:
kontent-ai-migration-toolkit --action=import --apiKey=xxx --environmentId=xxx --itemsFilename=data.json --format=json

# Import from csv file:
kontent-ai-migration-toolkit --action=import --apiKey=xxx --environmentId=xxx --itemsFilename=data.csv --format=csv
```

## Importing in code

Example below shows the most basic example of importing `content items` from a single `json` file

```typescript
const importToolkit = new ImportToolkit({
    sourceType: 'file',
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

await importToolkit.importAsync();
```

# Migration models

This tools uses simplified models to make migration simpler and more developer friendly. This is useful especially when
migrating from external systems because data structure is almost certainly very different to models used within
Kontent.ai APIs. These migration models act as an abstraction on the API layer.

### Model definitions

> Models are defined at
> https://github.com/Kontent-ai-consulting/kontent-ai-migration-toolkit/blob/main/lib/core/migration-models.ts

```typescript
export type MigrationElementType =
    | 'text'
    | 'rich_text'
    | 'number'
    | 'multiple_choice'
    | 'date_time'
    | 'asset'
    | 'modular_content'
    | 'taxonomy'
    | 'url_slug'
    | 'guidelines'
    | 'snippet'
    | 'custom'
    | 'subpages';

export interface IMigrationElement {
    value: string | undefined | string[];
    type: MigrationElementType;
    codename: string;
}

export interface IMigrationItem {
    system: {
        codename: string;
        name: string;
        language: string;
        type: string;
        collection: string;
        workflow_step?: string;
        workflow?: string;
    };
    elements: IMigrationElement[];
}

export interface IMigrationAsset {
    binaryData: Buffer | Blob | undefined;
    assetExternalId: string;
    filename: string;
    extension: string;
    url: string;
}
```

### Model examples

A single record of `IMigrationItem` type in `json` format may look like this:

```json
{
    "system": {
        "codename": "_the_dark_knight_rises",
        "collection": "default",
        "language": "en",
        "name": " The Dark Knight Rises",
        "type": "movie",
        "workflow_step": "published",
        "workflow": "default"
    },
    "elements": {
        "title": "The Dark Knight Rises",
        "plot": "<p>Eight years after the Joker's reign of anarchy, the Dark Knight, with the help of the enigmatic Selina, is forced from his imposed exile to save Gotham City, now on the edge of total annihilation, from the brutal guerrilla terrorist Bane.</p>",
        "released": "2012-07-20T00:00:00Z",
        "length": 164,
        "poster": [
            "https://assets-eu-01.kc-usercontent.com:443/cdbf5823-cbec-010d-f4c3-0411eee31c0e/787c8c83-16b4-40b4-878e-b90b6d42a4ef/the_dark_knight_rises.jpg"
        ],
        "category": ["sci_fi", "action"],
        "stars": ["christian_bale", "anne_hathaway", "tom_hardy"],
        "seoname": "the-dark-knight-rises",
        "releasecategory": []
    }
}
```

> You may find sample export (`.zip`) with both items & assets at
> https://github.com/Kontent-ai-consulting/kontent-ai-migration-toolkit/tree/main/samples/export-data

# Export items & assets from Kontent.ai

There is a built-in `kontentAi` adapter that can be used to export content items & assets from Kontent.ai environments.
However, when migration from 3rd party system you typically only use the `import` capabilities of this repository.

## Export Configuration

| Config              | Value                                                                                                                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **action**          | Action. Available options: `import` & `export` **(required)**                                                                                                                                                         |
| **environmentId**   | Id of Kontent.ai project **(required)**                                                                                                                                                                               |
| **adapter**         | Adapter used to export data into known format that can be used for importing data. Available options: `kontentAi` **(required)**                                                                                      |
| **format**          | Format used to export data. Available options: `csv`, `json` and `jsonJoined` **(required)**                                                                                                                          |
| secureApiKey        | API key for secure Access. `isSecure` also needs to be enabled                                                                                                                                                        |
| previewApiKey       | API key for preview. `isPreview` also needs to be enabled                                                                                                                                                             |
| isSecure            | When set to `true`, Secure API will be used to make data export. Defaults to `false`                                                                                                                                  |
| isPreview           | When set to `true`, Preview API will be used to make data export. Defaults to `false`                                                                                                                                 |
| exportAssets        | When set to `true`, Binary data of assets is exported. Defaults to `false`                                                                                                                                            |
| exporTypes          | CSV of content type codenames of which content items will be exported. If none is provided, all types are exported                                                                                                    |
| exporLanguages      | CSV of language codenames of which content items will be exported. If none is provided, all types are exported                                                                                                        |
| replaceInvalidLinks | RTE may contain links to invalid items. You won't be able to re-import such items due to validation error. By setting this to `true` the Migration Toolkit will automatically remove these links. Defaults to `false` |
| itemsFilename       | Name of the items file that will be created in folder where script is run                                                                                                                                             |
| assetsFilename      | Name of the assets file that will be created in folder where script is run. Only zip is supported.                                                                                                                    |
| baseUrl             | Custom base URL for Kontent.ai API calls                                                                                                                                                                              |

## Export CLI samples

```bash
# Export from Kontent.ai environment as json without assets
kontent-ai-migration-toolkit --action=export --adapter=kontentAi --environmentId=xxx --format=json

# Export from Kontent.ai environment as csv without assets:
kontent-ai-migration-toolkit --action=export --adapter=kontentAi --environmentId=xxx --format=csv

# Export from Kontent.ai environment as single json file with assets:
kontent-ai-migration-toolkit --action=export --adapter=kontentAi --environmentId=xxx --format=jsonJoined --exportAssets=true
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

const exportToolkit = new ExportToolkit({
    adapter,
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

await exportToolkit.exportAsync();
```

## CLI help

To see available commands use:

```bash
kontent-ai-migration-toolkit --help
```

## Use with config file

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
    "format": "json", // or 'jsonJoined' / 'csv'
    "logLevel": "verbose" // or 'default'
}
```

To execute your action run:

```bash
kontent-ai-migration-toolkit --config=export-config.json
```

## Code samples for import & export

See https://github.com/Kontent-ai-consulting/kontent-ai-migration-toolkit/tree/main/samples for examples of how to run
this library in code rather then via command line.

## Output / Input formats

This library provides `csv`, `json`, `jsoinJoined` formats out of the box. However, you can create your own format by
implementing `IFormatService` and supplying that to import / export functions. This is useful if you need to extend the
existing format, change how it's processing or just support new formats such as `xliff`, `xlxs`, `xml` or other.

Following is a list of `built-in` format services:

| Type         | Service                           | Link                                                                                                                                                  |
| ------------ | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `csv`        | `ItemCsvProcessorService `        | https://github.com/Kontent-ai-consulting/kontent-ai-migration-toolkit/blob/main/lib/file-processor/item-formats/item-csv-processor.service.ts         |
| `json`       | `ItemJsonProcessorService `       | https://github.com/Kontent-ai-consulting/kontent-ai-migration-toolkit/blob/main/lib/file-processor/item-formats/item-json-processor.service.ts        |
| `jsonJoined` | `ItemJsonJoinedProcessorService ` | https://github.com/Kontent-ai-consulting/kontent-ai-migration-toolkit/blob/main/lib/file-processor/item-formats/item-json-joined-processor.service.ts |

## Limitations

Export is made with `Delivery API` for speed and efficiency, but this brings some limitations:

-   Assets are exported without their `title`. If you import these assets back to a different project, the `filename` is
    used as a `title`. Similarly, folder structure of imported assets is not preserved. This only applies when asset is
    actually imported as if the asset already exists in target project, it is skipped from import (this is often the
    case if the export and import environments are one and the same)
-   Language variants in `Scheduled` workflow step are not migrated to this workflow step because the API is missing the
    information about scheduled time so there is no way to specify scheduled publish time

## FAQ

### I'm getting `Header overflow` exception

The Node.js limits the maximum header size of HTTP requests. In some cases it may be required for you to increase this
limitation to be able to successfully fetch data from Kontent.ai. You can do so by using the `max-http-header-size`
option (https://nodejs.org/api/cli.html#--max-http-header-sizesize)

Example script call:

```bash
node --max-http-header-size 150000 %USERPROFILE%\AppData\Roaming\npm\node_modules\kontent-ai-migration-toolkit\dist\cjs\lib\node\cli\app --action=export --apiKey=<key> --environmentId=<environmentId>
```
