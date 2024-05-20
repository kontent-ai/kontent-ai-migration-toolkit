# Kontent.ai Migration Toolkit

The purpose of this tool is to facilitate migration to & from [Kontent.ai](https://kontent.ai) environments using a
developer friendly abstraction layer.

> [!TIP]  
> This library aim to streamline the migration to / from Kontent.ai environment by providing a simple to use abstraction
> layer and simplifies management of content items, language variants, moving items through workflow, publishing,
> archiving, downloading binary data, uploading assets, `id` to `codename` translation and more.

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

# Import

> [!CAUTION]  
> **We do not recommended importing into a production environment directly without testing**. Instead you should first
> create a testing environment and run the script there to make sure everything works as you intended to.

> [!NOTE]  
> When importing it is essential that the target project structure (i.e. `Content types`, `Taxonomies`, `Collections`,
> `Workflows`, `languages`...) are consistent with the ones defined in source environment. Any inconsistency in data
> such as referencing inexistent taxonomy term, incorrect element type and other inconsistencies may cause import to
> fail.

## Configuration

| Config            | Value                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **action**        | Action. Available options: `import` & `export` **(required)**                                                                                           |
| **environmentId** | Id of Kontent.ai project **(required)**                                                                                                                 |
| **apiKey**        | Management API key **(required)**                                                                                                                       |
| **itemsFilename** | Name of the items file that will be used to parse items **(required)**                                                                                  |
| assetsFilename    | Name of the items file that will be used to parse assets                                                                                                |
| baseUrl           | Custom base URL for Kontent.ai API calls                                                                                                                |
| skipFailedItems   | Indicates if failed content items & language variants should be skipped if their import fails. Available options: `true` & `false`. Detaults to `false` |
| force             | Can be used to disable confirmation prompts. Available options: `true` & `false`. Detaults to `false`                                                   |

### How are content items imported?

The Migration Toolkit creates content items that are not present in target project. If the content item exists in target
project (based on item's `codename`) the item will be updated. The workflow will be set according to `workflow_step` and
`workflow` fields.

You can run `kontent-ai-migration-toolkit` many times over without being worried that identical content items will be
created multiple times.

### How are assets imported?

If asset exists in target project (based on asset's `codename`), the asset upload will be skipped and not uploaded at
all. Otherwise the asset will be created in target environment.

## Import CLI samples

```bash
# Import to target environment
kontent-ai-migration-toolkit --action=import --apiKey=xxx --environmentId=xxx --format=json --itemsFilename=items.zip --assetsFilename=assets.zip
```

# Export from Kontent.ai

There is a built-in `kontentAi` adapter that can be used to export content items & assets from Kontent.ai environments.
However, when migration from 3rd party system you typically only use the `import` capabilities of this repository.

## Configuration

| Config            | Value                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| **action**        | Action. Available options: `import` & `export` **(required)**                                      |
| **environmentId** | Id of Kontent.ai environment **(required)**                                                        |
| **apiKey**        | Management API key of Kontent.ai environment **(required)**                                        |
| **language**      | Codename of language that items will be exported in **(required)**                                 |
| **items**         | Comma separated list of items that will be exported **(required)**                                 |
| itemsFilename     | Name of the items file that will be created in folder where script is run                          |
| assetsFilename    | Name of the assets file that will be created in folder where script is run. Only zip is supported. |
| baseUrl           | Custom base URL for Kontent.ai API calls                                                           |

## Export CLI

```bash
# Export from Kontent.ai environment
kontent-ai-migration-toolkit --action=export --adapter=kontentAi --environmentId=xxx --format=json --language=default --items=itemA,itemB
```

## Limitations

1. Asset folder assignments are not preserved during migration because folders can be referenced only by id's and not
   codenames.
2. Assets element values are not preserved during migration because elements can be referenced only by id's and not
   codenames.
3. Components embedded within Rich text elements are not exported
4. Language variants in `Scheduled` workflow step do not preserve their workflow status because it the API does not
   provide an information about scheduled times

## Code examples

1. [Import](https://github.com/Kontent-ai-consulting/kontent-ai-migration-toolkit/blob/main/samples/import-toolkit-sample.ts)
2. [Export](https://github.com/Kontent-ai-consulting/kontent-ai-migration-toolkit/blob/main/samples/export-toolkit-sample.ts)
3. [Export from external system](https://github.com/Kontent-ai-consulting/kontent-ai-migration-toolkit/blob/main/samples/export-from-external-system.ts)

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
    "apiKey": "y"
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

This library provides `json` format out of the box. However, you can create your own format by implementing
`IFormatService`. This is useful if you need to support additional formats such as `xliff`, `xlxs`, `xml`, `csv` or
others.

Default formatting services:

| Type   | Service                     | Link                                                                                                                                                  |
| ------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
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
