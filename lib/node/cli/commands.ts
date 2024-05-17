import { getCliArgs } from './args/cli-args.class.js';

export const cliArgs = getCliArgs()
    .withExample({
        command: 'action',
        example: `kontent-ai-migration-toolkit --action=import --apiKey=xxx --environmentId=xxx --format=json --itemsFilename=items.zip --assetsFilename=assets.zip`
    })
    .withExample({
        command: 'action',
        example: `kontent-ai-migration-toolkit --action=export --adapter=kontentAi --environmentId=xxx --format=json --language=default --items=itemA,itemB`
    })
    .withCommand({
        alias: `a`,
        name: `action`,
        description: `Type of action to execute`,
        type: 'string'
    })
    .withCommand({
        alias: `d`,
        name: `adapter`,
        description: `Adapter used to export data`,
        type: 'string'
    })
    .withCommand({
        alias: `k`,
        name: `apiKey`,
        description: `Api key used for request authorization`,
        type: 'string'
    })
    .withCommand({
        alias: `i`,
        name: `items`,
        description: `Comma separated item codenames to export`,
        type: 'array'
    })
    .withCommand({
        alias: `l`,
        name: `language`,
        description: `Language codename of items to export`,
        type: 'string'
    })
    .withCommand({
        name: `itemsFilename`,
        description: `Name of items file to export / import`,
        type: 'string'
    })
    .withCommand({
        name: `assetsFilename`,
        description: `Name of assets file to export / import`,
        type: 'string'
    })
    .withCommand({
        alias: `f`,
        name: `format`,
        description: `Format of the export / import`,
        type: 'string'
    })
    .withCommand({
        alias: `b`,
        name: `baseUrl`,
        description: `Custom base URL`,
        type: 'string'
    })
    .withCommand({
        alias: `s`,
        name: `skipFailedItems`,
        description: `Indicates whether import should skip items that fail to import and cotinue with next item`,
        type: 'boolean'
    })
    .withCommand({
        alias: `h`,
        name: `help`,
        description: `Show help`
    });
