import * as dotenv from 'dotenv';
import {
    confirmExportAsync,
    exportAsync,
    handleError,
    storeAsync,
    getDefaultLogger,
    SourceExportItem
} from '../../lib/index.js';
import { getEnvironmentRequiredValue } from './utils/test.utils.js';

const run = async () => {
    dotenv.config({
        path: '../../.env.local'
    });

    const environmentId = getEnvironmentRequiredValue('sourceEnvironmentId');
    const apiKey = getEnvironmentRequiredValue('sourceApiKey');
    const logger = getDefaultLogger();
    const exportItem: SourceExportItem[] = [
        {
            itemCodename: getEnvironmentRequiredValue('item'),
            languageCodename: getEnvironmentRequiredValue('language')
        }
    ];

    await confirmExportAsync({
        force: false,
        apiKey: apiKey,
        environmentId: environmentId,
        logger: logger,
        dataToExport: {
            itemsCount: exportItem.length
        }
    });

    const exportData = await exportAsync({
        logger: logger,
        environmentId: environmentId,
        apiKey: apiKey,
        exportItems: exportItem
    });

    await storeAsync({
        data: exportData,
        filename: 'data.zip'
    });
};

run().catch((error) => {
    handleError(error);
});
