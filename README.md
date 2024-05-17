# Kontent.ai Migration Toolkit

The purpose of this tool is to facilitate migration to & from [Kontent.ai](https://kontent.ai) environments using a
developer friendly abstraction layer.

> [!TIP]  
> This library uses intermediate `json` and `csv` formats (`csv` being experimental) to `export` from a Kontent.ai
> environment and `import` to another. This can be done via CLI or via code. This library takes care of preparing
> content items, language variants, moving items through workflow, publishing, archiving, downloading binary data,
> uploading assets, id-codename translation and more.

This library can only be used in `node.js`. Use in Browsers is not supported.

# Getting started

Use `--help` anytime to get information about available commands and their options.

```bash
npx @kontent-ai-consulting/migration-toolkit --help

# you can also install the package globally, or locally
npm i @kontent-ai-consulting/migration-toolkit -g

# with the package installed, you can call the tool as follows
kontent-ai-migration-toolkit --help
```

# Migrating data from external / 3rd party systems

# Import

> [!CAUTION]  
> **We do not recommended importing into a production environment directly** (without proper testing). Instead you
> should first create a testing environment and run the script there to make sure everything works as you intended to.

> [!NOTE]  
> When importing it is essential that the target project structure (e.g. `Content types`, `Taxonomies`, `Collections`,
> `Workflows`...) are consistent with the ones defined in source environment. Any inconsistency in data such as
> referencing inexistent taxonomy term, incorrect element type and other inconsistencies may cause import to fail.

## How are content items & language variants imported?

The Migration Toolkit creates content items that are not present in target project. If the content item exists in target
project (based on item's `codename`) the item will be updated instead. The workflow of imported language variant will be
set according to `workflow_step` and `workflow` fields.

You can run `kontent-ai-migration-toolkit` many times over without being worried that identical content items will be
created multiple times.

## How are assets imported?

If asset exists in target project (based on asset's `codename`), the asset upload will be skipped and not uploaded at
all. Otherwise the asset will be created in target environment.

## Import Configuration

| Config            | Value                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **action**        | Action. Available options: `import` & `export` **(required)**                                                                                           |
| **environmentId** | Id of Kontent.ai project **(required)**                                                                                                                 |
| **apiKey**        | Management API key **(required)**                                                                                                                       |
| **format**        | Format used to export data. Available options: `csv`, `json` or custom implementation **(required)**                                                    |
| **itemsFilename** | Name of the items file that will be used to parse items **(required)**                                                                                  |
| assetsFilename    | Name of the items file that will be used to parse assets (only zip supported)                                                                           |
| baseUrl           | Custom base URL for Kontent.ai API calls                                                                                                                |
| skipFailedItems   | Indicates if failed content items & language variants should be skipped if their import fails. Available options: `true` & `false`. Detaults to `false` |
| force             | Can be used to disable confirmation prompts. Available options: `true` & `false`. Detaults to `false`                                                   |

## Import CLI samples

```bash
# Import to target environment
kontent-ai-migration-toolkit --action=import --apiKey=xxx --environmentId=xxx --format=json --itemsFilename=items.zip --assetsFilename=assets.zip
```

## Importing in code

Examples of importing in code can be found at:

1. [Import from json](https://github.com/Kontent-ai-consulting/kontent-ai-migration-toolkit/blob/main/samples/import-from-json.ts)
1. [Import from csv](https://github.com/Kontent-ai-consulting/kontent-ai-migration-toolkit/blob/main/samples/import-from-csv.ts)
1. [Import from zip](https://github.com/Kontent-ai-consulting/kontent-ai-migration-toolkit/blob/main/samples/import-from-zip-sample.ts)
1. [Direct import without files](https://github.com/Kontent-ai-consulting/kontent-ai-migration-toolkit/blob/main/samples/migrate-directly.ts)

# Export from Kontent.ai

There is a built-in `kontentAi` adapter that can be used to export content items & assets from Kontent.ai environments.
However, when migration from 3rd party system you typically only use the `import` capabilities of this repository.

## Export from Kontent.ai Configuration

| Config               | Value                                                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **action**           | Action. Available options: `import` & `export` **(required)**                                                                    |
| **environmentId**    | Id of Kontent.ai environment **(required)**                                                                                      |
| **managementApiKey** | Management API key of Kontent.ai environment **(required)**                                                                      |
| **adapter**          | Adapter used to export data into known format that can be used for importing data. Available options: `kontentAi` **(required)** |
| **format**           | Format used to export data. Available options: `csv`, `json` **(required)**                                                      |
| **language**         | Codename of language that items will be exported in **(required)**                                                               |
| **items**            | Comma separated list of items that will be exported **(required)**                                                               |
| itemsFilename        | Name of the items file that will be created in folder where script is run                                                        |
| assetsFilename       | Name of the assets file that will be created in folder where script is run. Only zip is supported.                               |
| baseUrl              | Custom base URL for Kontent.ai API calls                                                                                         |

## Export CLI samples

```bash
# Export from Kontent.ai environment
kontent-ai-migration-toolkit --action=export --adapter=kontentAi --environmentId=xxx --format=json --language=default --items=itemA,itemB
```

## Exporting in code

You may use this library outside of CLI:

1. [Export from Kontent.ai environment](https://github.com/Kontent-ai-consulting/kontent-ai-migration-toolkit/blob/main/samples/export-kontent-ai.ts)
1. [Custom export with files](https://github.com/Kontent-ai-consulting/kontent-ai-migration-toolkit/blob/main/samples/migrate-with-files.ts)
1. [Custom export and direct import](https://github.com/Kontent-ai-consulting/kontent-ai-migration-toolkit/blob/main/samples/migrate-directly.ts)

# Limitations

1. Asset folder assignments are not preserved during migration because folders can be referenced only by id's and not
   codenames.
2. Assets element values are not preserved during migration because elements can be referenced only by id's and not
   codenames.
3. Components embedded within Rich text elements are not migrated
4. Language variants in `Scheduled` workflow step do not preserve their workflow status because it the API does not
   provide an information about scheduled times

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
    "secureApiKey": "y"
    // other props
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

This library provides `csv` and `json` formats out of the box. However, you can create your own format by implementing
`IFormatService` and supplying that to import / export functions. This is useful if you need to extend the existing
format, change how it's processing or just support new formats such as `xliff`, `xlxs`, `xml` or other.

Following is a list of `built-in` format services:

| Type   | Service                     | Link                                                                                                                                                  |
| ------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `csv`  | `ItemCsvProcessorService `  | https://github.com/Kontent-ai-consulting/kontent-ai-migration-toolkit/blob/main/lib/file-processor/item-formats/item-csv-processor.service.ts         |
| `json` | `ItemJsonProcessorService ` | https://github.com/Kontent-ai-consulting/kontent-ai-migration-toolkit/blob/main/lib/file-processor/item-formats/item-json-joined-processor.service.ts |

## FAQ

### I'm getting `Header overflow` exception

The Node.js limits the maximum header size of HTTP requests. In some cases it may be required for you to increase this
limitation to be able to successfully fetch data from Kontent.ai. You can do so by using the `max-http-header-size`
option (https://nodejs.org/api/cli.html#--max-http-header-sizesize)

Example script call:

```bash
node --max-http-header-size 150000 %USERPROFILE%\AppData\Roaming\npm\node_modules\kontent-ai-migration-toolkit\dist\cjs\lib\node\cli\app --action=export --apiKey=<key> --environmentId=<environmentId>
```
