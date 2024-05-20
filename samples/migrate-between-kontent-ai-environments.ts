import { getDefaultLog, MigrationToolkit } from '../lib/index.js';

const migrationToolkit = new MigrationToolkit({
    log: getDefaultLog(),
    sourceEnvironment: {
        apiKey: '<key>',
        id: '<id>',
        items: [
            {
                itemCodename: '<itemCodename>',
                languageCodename: '<languageCodename>'
            }
        ]
    },
    targetEnvironment: {
        apiKey: '<key>',
        id: '<id>'
    }
});

await migrationToolkit.migrateAsync();
