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
    readonly items: Readonly<InputItem[]>;
    readonly parallelLimit: number;
    readonly processAsync: (item: Readonly<InputItem>, logSpinner: LogSpinnerData) => Promise<Readonly<OutputItem>>;
    readonly itemInfo: (item: Readonly<InputItem>) => ItemInfo;
}): Promise<readonly OutputItem[]> {
    if (!data.items.length) {
        return [];
    }

    return await data.logger.logWithSpinnerAsync(async (logSpinner) => {
        const limit = pLimit(data.parallelLimit);
        let index: number = 1;

        const requests: Promise<OutputItem>[] = data.items.map((item) =>
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
                    return output;
                });
            })
        );

        // Only '<parallelLimit>' promises at a time
        const outputItems = await Promise.all(requests);

        logSpinner({ type: 'info', message: `Action '${chalk.yellow(data.action)}' finished successfully` });

        return outputItems;
    });
}

function getCountPrefix(index: number, totalCount: number): string {
    return `${chalk.cyan(`${index}/${totalCount}`)}`;
}
