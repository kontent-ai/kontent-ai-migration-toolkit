import chalk from 'chalk';
import pLimit from 'p-limit';
import { ItemInfo } from '../models/core.models.js';
import { LogSpinnerData, Logger } from '../models/log.models.js';

type SetAction =
    | 'Fetching assets'
    | 'Downloading assets'
    | 'Fetching content items'
    | 'Preparing content items & language variants'
    | 'Importing content items'
    | 'Importing language variants'
    | 'Fetching language variants'
    | 'Uploading assets';

export async function processSetAsync<InputItem, OutputItem>(data: {
    readonly action: SetAction;
    readonly logger: Logger;
    readonly items: InputItem[];
    readonly parallelLimit: number;
    readonly processAsync: (item: InputItem, logSpinner: LogSpinnerData) => Promise<OutputItem>;
    readonly itemInfo: (item: InputItem) => ItemInfo;
}): Promise<OutputItem[]> {
    if (!data.items.length) {
        return [];
    }

    const outputItems: OutputItem[] = [];
    const limit = pLimit(data.parallelLimit);

    return await data.logger.logWithSpinnerAsync(async (logSpinner) => {
        let index: number = 1;

        const requests = data.items.map((item) =>
            limit(() => {
                const itemInfo = data.itemInfo(item);
                const countPrefix = getCountPrefix(index, data.items.length);

                logSpinner({
                    prefix: countPrefix,
                    message: itemInfo.title,
                    type: itemInfo.itemType
                });

                index++;

                return data.processAsync(item, logSpinner).then((output) => {
                    outputItems.push(output);
                });
            })
        );

        // Only '<parallelLimit>' promises at a time
        await Promise.all(requests);

        logSpinner({ type: 'info', message: `Action '${chalk.yellow(data.action)}' finished successfully` });

        return outputItems;
    });
}

function getCountPrefix(index: number, totalCount: number): string {
    return `${chalk.cyan(`${index}/${totalCount}`)}`;
}
