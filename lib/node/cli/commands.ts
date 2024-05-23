import { getCliArgs } from './args/cli-args.class.js';

export const cliArgs = getCliArgs()
    .withCommand({
        name: 'export',
        description: 'Exports content (items & assets) from Kontent.ai environment',
        examples: [
            `kontent-ai-migration-toolkit export --sourceEnvironmentId=x --sourceApiKey=x --language=default --items=itemA,itemB`
        ],
        options: [
            {
                name: `sourceApiKey`,
                description: `Api key used for request authorization`,
                type: 'string',
                isRequired: true
            },
            {
                name: `sourceEnvironmentId`,
                description: `Environment id of the source environment`,
                type: 'string',
                isRequired: true
            },
            {
                name: `language`,
                description: `Language codename of items to export`,
                type: 'string',
                isRequired: true
            },
            {
                name: `items`,
                description: `Comma separated item codenames to export`,
                type: 'string',
                isRequired: true
            },
            {
                name: `itemsFilename`,
                description: `Name of items file to export / import`,
                type: 'string',
                isRequired: false
            },
            {
                name: `assetsFilename`,
                description: `Name of assets file to export / import`,
                type: 'string',
                isRequired: false
            },
            {
                name: `baseUrl`,
                description: `Custom base URL`,
                type: 'string',
                isRequired: false
            }
        ]
    })

    .withCommand({
        name: 'import',
        description: 'Imports content (items & assets) into Kontent.ai environment',
        examples: [
            `kontent-ai-migration-toolkit import --targetEnvironmentId=x --targetApiKey=x --itemsFilename=items.zip --assetsFilename=assets.zip`
        ],
        options: [
            {
                name: `targetApiKey`,
                description: `Api key used for request authorization`,
                type: 'string',
                isRequired: true
            },
            {
                name: `targetEnvironmentId`,
                description: `Environment id of the target environment`,
                type: 'string',
                isRequired: true
            },
            {
                name: `itemsFilename`,
                description: `Name of items file to export / import`,
                type: 'string',
                isRequired: false
            },
            {
                name: `assetsFilename`,
                description: `Name of assets file to export / import`,
                type: 'string',
                isRequired: false
            },
            {
                name: `skipFailedItems`,
                description: `Indicates whether the import should continue even if some item fails to import`,
                type: 'string',
                isRequired: false
            },
            {
                name: `baseUrl`,
                description: `Custom base URL`,
                type: 'string',
                isRequired: false
            }
        ]
    })

    .withCommand({
        name: 'migrate',
        description:
            'Migrates content (items & assets) from one Kontent.ai environment into another Kontent.ai environment',
        examples: [
            `kontent-ai-migration-toolkit migrate --targetEnvironmentId=x --targetApiKey=x --sourceEnvironmentId=x --sourceApiKey=x --language=default --items=itemA,itemB`
        ],
        options: [
            {
                name: `sourceApiKey`,
                description: `Api key used for request authorization`,
                type: 'string',
                isRequired: true
            },
            {
                name: `sourceEnvironmentId`,
                description: `Environment id of the source environment`,
                type: 'string',
                isRequired: true
            },
            {
                name: `language`,
                description: `Language codename of items to export`,
                type: 'string',
                isRequired: true
            },
            {
                name: `items`,
                description: `Comma separated item codenames to export`,
                type: 'string',
                isRequired: true
            },
            {
                name: `targetApiKey`,
                description: `Api key used for request authorization`,
                type: 'string',
                isRequired: true
            },
            {
                name: `targetEnvironmentId`,
                description: `Environment id of the target environment`,
                type: 'string',
                isRequired: true
            },
            {
                name: `skipFailedItems`,
                description: `Indicates whether the import should continue even if some item fails to import`,
                type: 'string',
                isRequired: false
            },
            {
                name: `baseUrl`,
                description: `Custom base URL`,
                type: 'string',
                isRequired: false
            }
        ]
    })

    .withOption({
        alias: `f`,
        name: `force`,
        description: `When enabled, confirmation is not required`,
        type: 'boolean',
        isRequired: false
    })
    .withOption({
        alias: `h`,
        name: `help`,
        description: `Show help`,
        isRequired: false
    });
