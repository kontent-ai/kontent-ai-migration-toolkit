# Kontent.ai Migration Toolkit

The purpose of this tool is to facilitate _content migration_ to & from [Kontent.ai](https://kontent.ai) environments.
It can be used to simplify migration from external systems and also provides a built-in migration between kontent.ai
environments.

> [!TIP]  
> This library aims to streamline the migration to / from Kontent.ai environments by providing an abstraction layer
> which handles creation / updates of content items, language variants, moving items through workflow, publishing,
> archiving, downloading binary data, uploading assets, `id` to `codename` translation and more.

This library can only be used as a library both in `node.js` & `browser` or as a `CLI` utility.

# Getting started

Use `--help` anytime to get information about available commands and their options.

```bash
npx @kontent-ai-consulting/migration-toolkit --help

# you can also install the package globally, or locally
npm i @kontent-ai-consulting/migration-toolkit -g

# with the package installed, you can call the tool as follows
kontent-ai-migration-toolkit --help

# or check details of particular command
kontent-ai-migration-toolkit migrate --help
```

## Code examples

1. [Import](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/blob/main/samples/import-sample.ts)
2. [Export](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/blob/main/samples/export-sample.ts)
3. [Migrate from external system](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/blob/main/samples/migrate-from-external-system.ts)
4. [Migrate content between Kontent.ai environments](https://github.com/Kontent-ai/kontent-ai-migration-toolkit/blob/main/samples/migrate-between-kontent-ai-environments.ts)

> [!NOTE]  
> You can run `kontent-ai-migration-toolkit` many times over without being worried that duplicate content items / assets
> are created.

# Migrate between Kontent.ai environments

You may migrate content (items & asset) between Kontent.ai environments. For migrating _Data model / structure_ see
[Data Ops](https://github.com/kontent-ai/data-ops) instead.

> [!CAUTION]  
> **We recommend migrating to test / dev environments first ** to ensure nothing unexpected happens..

## Configuration

| Config                  | Value                                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| **sourceEnvironmentId** | Id of source environment **(required)**                                                               |
| **sourceApiKey**        | Management API key of source environment **(required)**                                               |
| **targetEnvironmentId** | Id of target environment **(required)**                                                               |
| **targetApiKey**        | Management API key of target environment **(required)**                                               |
| **language**            | Codename of language that items will be exported in **(required)**                                    |
| **items**               | Comma separated list of items that will be exported **(required)**                                    |
| force                   | Can be used to disable confirmation prompts. Available options: `true` & `false`. Detaults to `false` |

## Migrate CLI

```bash
# Migrate from Kontent.ai environment into another Kontent.ai environment
kontent-ai-migration-toolkit migrate --targetEnvironmentId=x --targetApiKey=x --sourceEnvironmentId=x --sourceApiKey=x --language=default --items=itemA,itemB
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

| Config                  | Value                                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| **targetEnvironmentId** | Id of Kontent.ai environment **(required)**                                                           |
| **targetApiKey**        | Management API key **(required)**                                                                     |
| **filename**            | Name of the zip file **(required)**                                                                   |
| baseUrl                 | Custom base URL for Kontent.ai API calls                                                              |
| force                   | Can be used to disable confirmation prompts. Available options: `true` & `false`. Detaults to `false` |

## Import CLI

```bash
# Import into target environment
kontent-ai-migration-toolkit import --targetEnvironmentId=x --targetApiKey=x --filename=data.zip
```

# Migrate from Kontent.ai

This library can also be used to export content items & assets from Kontent.ai environments. However, when migration
from 3rd party system you typically only use the `import` capabilities of this repository.

## Configuration

| Config                  | Value                                                              |
| ----------------------- | ------------------------------------------------------------------ |
| **sourceEnvironmentId** | Id of Kontent.ai environment **(required)**                        |
| **sourceApiKey**        | Management API key of Kontent.ai environment **(required)**        |
| **language**            | Codename of language that items will be exported in **(required)** |
| **items**               | Comma separated list of items that will be exported **(required)** |
| filename                | Name of the zip file                                               |
| baseUrl                 | Custom base URL for Kontent.ai API calls                           |

## Export CLI

```bash
# Export from Kontent.ai environment
kontent-ai-migration-toolkit export --sourceEnvironmentId=x --sourceApiKey=x --language=default --items=itemA,itemB
```

# Migrate from external systems

You can use this library when exporting from 3rd party systems (i.e. legacy CMS) as it will abstract your from using
Kontent.ai Management API directly.

The main focus is therefore on transforming the data you need to migrate into a format this library supports. The main
migration models are `MigrationItem` and `MigrationAsset`. For creating element values `elementsBuilder`.

See below example of using a strongly typed model and migrating a single item with an asset.

```typescript
/**
 * Optionally (but strongly recommended) you may define a migration model
 * representing the content type you are trying to migrate into
 */
interface ArticleElements extends MigrationElements {
    title: MigrationElementModels.TextElement;
    rating: MigrationElementModels.NumberElement;
    related_pages: MigrationElementModels.LinkedItemsElement;
    teaser_image: MigrationElementModels.AssetElement;
}

const migrationItem: MigrationItem<ArticleElements> = {
    system: {
        name: 'My article',
        // codename is primary identifier - also used for validating whether asset exists in target env
        codename: 'myArticle',
        collection: {
            // collection codename must match the collection in your target K.ai environment
            codename: 'default'
        },
        language: {
            // language codename must match the language in your target K.ai environment
            codename: 'en_uk'
        },
        type: {
            // type codename must match the content type codename in your target K.ai environment
            codename: 'article'
        }
    },
    elements: {
        title: elementsBuilder.textElement({ value: 'Title of the article' }),
        rating: elementsBuilder.numberElement({ value: 5 }),
        related_pages: elementsBuilder.linkedItemsElement({
            value: [
                {
                    codename: 'pageA'
                },
                {
                    codename: 'pageB'
                }
            ]
        }),
        // assets are referenced by their codename
        teaser_image: elementsBuilder.assetElement({ value: [{ codename: 'article_teaser' }] })
    }
};

const migrationAsset: MigrationAsset = {
    // codename of the asset - Used for validating whether asset exists in target env
    codename: 'article_teaser',
    // filename will be used in K.ai asset as a filename
    filename: 'article_teaser.jpg',
    // title will be used in K.ai asset as a title
    title: 'Article teaser',
    // binary data of the asset you want to upload
    binaryData: <BinaryData>,
    // collection assignment
    collection: {
        codename: 'teasers'
    },
    // description of asset in project languages
    descriptions: [
        {
            description: 'Teaser of the article',
            language: {
                codename: 'en_uk'
            }
        }
    ]
};
```

Once you are happy with the data, you can import them to Kontent.ai using the `importAsync` function.

```typescript
await importAsync({
    environmentId: environmentId,
    apiKey: apiKey,
    data: {
        assets: [migrationAsset],
        items: [migrationItem]
    }
});
```

# Migration / import processing

### How are content items imported?

The Migration Toolkit creates content items that are not present in target project. If the content item exists in target
project (based on item's `codename`) the item will be updated, otherwise it will be created. No duplicate items will be
created. The workflow of the item in target environment will be set to match the source environment.

### How are assets imported?

If asset exists in target project (based on asset's `codename`), the asset upload will be skipped and not uploaded at
all. Otherwise the asset will be created in target environment.

### How are referenced content items & asset handled?

If you have a reference to a content item or asset (i.e. in linked items element, asset element, rich text element...)
the migration toolkit first checks whether the referenced object exists (based on item or asset `codename`) and if it
does, successfuly sets the reference. If the object does not exist, it will be referenced by an `external_id` which
creates a placeholder for the item until it becomes available.

See the table below to learn how `external_id` is generated by default:

| Object type      | Template           | Sample `codename` of the object | Generated `external_id` |
| ---------------- | ------------------ | ------------------------------- | ----------------------- |
| **Asset**        | `asset_{codename}` | my_file                         | `asset_my_file`         |
| **Content item** | `item_{codename}`  | article                         | `item_article`          |

If you need to change the way `external_id` is created, you may supply a custom implementation of `externalIdGenerator`
within import / migrate functions.

## Limitations

1. Asset folder assignments are not preserved during migration because folders can be referenced only by id's and not
   codenames.
2. Assets element values are not preserved during migration because elements can be referenced only by id's and not
   codenames.
3. Language variants in `Scheduled` workflow step do not preserve their workflow status because the API does not provide
   an information about scheduled times

## FAQ

### I'm getting `Header overflow` exception

The Node.js limits the maximum header size of HTTP requests. In some cases it may be required for you to increase this
limitation to be able to successfully fetch data from Kontent.ai. You can do so by using the `max-http-header-size`
option (https://nodejs.org/api/cli.html#--max-http-header-sizesize)

Example script call:

```bash
node --max-http-header-size 150000 %USERPROFILE%\AppData\Roaming\npm\node_modules\kontent-ai-migration-toolkit\dist\cjs\lib\node\cli\app --action=export --apiKey=<key> --environmentId=<environmentId>
```
