import chalk from 'chalk';
import pLimit from 'p-limit';
import { ItemInfo, ItemProcessingResult } from '../models/core.models.js';
import { LogSpinnerData, Logger } from '../models/log.models.js';

type ProcessSetAction =
    | 'Fetching assets'
    | 'Downloading assets'
    | 'Fetching content items'
    | 'Preparing content items & language variants'
    | 'Importing content items'
    | 'Importing language variants'
    | 'Fetching language variants'
    | 'Upserting assets'
    | 'Uploading assets';

export async function processItemsAsync<InputItem, OutputItem>(data: {
    readonly action: ProcessSetAction;
    readonly logger: Logger;
    readonly items: Readonly<InputItem[]>;
    readonly parallelLimit: number;
    readonly processAsync: (item: Readonly<InputItem>, logSpinner: LogSpinnerData) => Promise<Readonly<OutputItem>>;
    readonly itemInfo: (item: Readonly<InputItem>) => ItemInfo;
}): Promise<readonly ItemProcessingResult<InputItem, OutputItem>[]> {
    if (!data.items.length) {
        return [];
    }

    const firstItemInfo = data.itemInfo(data.items[0]);

    return await data.logger.logWithSpinnerAsync(async (logSpinner) => {
        const limit = pLimit(data.parallelLimit);
        let processedItemsCount: number = 1;

        const requests: Promise<ItemProcessingResult<InputItem, OutputItem>>[] = data.items.map((item) =>
            limit(() => {
                return data
                    .processAsync(item, logSpinner)
                    .then<OutputItem>((output) => {
                        const itemInfo = data.itemInfo(item);
                        const prefix = getPercentagePrefix(processedItemsCount, data.items.length);

                        logSpinner({
                            prefix: prefix,
                            message: itemInfo.title,
                            type: itemInfo.itemType
                        });

                        processedItemsCount++;
                        return output;
                    })
                    .then<ItemProcessingResult<InputItem, OutputItem>>((outputItem) => {
                        return {
                            inputItem: item,
                            outputItem: outputItem
                        };
                    })
                    .catch<ItemProcessingResult<InputItem, OutputItem>>((error) => {
                        return {
                            inputItem: item,
                            outputItem: undefined,
                            error: error
                        };
                    });
            })
        );

        // log processing of first item as progress is set after each item finishes
        logSpinner({
            prefix: getPercentagePrefix(0, data.items.length),
            message: firstItemInfo.title,
            type: firstItemInfo.itemType
        });

        // Only '<parallelLimit>' promises at a time
        const resultItems = await Promise.all(requests);

        const failedItemsCount = resultItems.filter((m) => !m.outputItem).length;
        const failedText = failedItemsCount ? ` Failed (${chalk.red()}) items` : ``;

        logSpinner({
            type: 'info',
            message: `Completed '${chalk.yellow(data.action)}'. Processed (${chalk.green(
                resultItems.filter((m) => m.outputItem).length
            )}) items.${failedText}`
        });

        return resultItems;
    });
}

function getPercentagePrefix(processedItems: number, totalCount: number): string {
    return chalk.gray(`${Math.round((processedItems / totalCount) * 100)}%`);
}
