import { ManagementClient } from '@kontent-ai/management-sdk';
import { HttpService } from '@kontent-ai/core-sdk';

import {
    defaultRetryStrategy,
    handleError,
    ItemType,
    printProjectInfoToConsoleAsync
} from '../core';
import { ICleanConfig, ICleanResult } from './clean.models';

export class CleanService {
    private readonly client: ManagementClient;

    constructor(private config: ICleanConfig) {
        this.client = new ManagementClient({
            apiKey: config.apiKey,
            projectId: config.projectId,
            baseUrl: config.baseUrl,
            httpService: new HttpService({
                logErrorsToConsole: false
            }),
            retryStrategy: config.retryStrategy ?? defaultRetryStrategy
        });
    }

    public async cleanAllAsync(): Promise<ICleanResult> {
        try {
            await printProjectInfoToConsoleAsync(this.client);

            await this.cleanContentItemsAsync();
            await this.cleanAssetsAsync();

            return {
                metadata: {
                    projectId: this.config.projectId,
                    timestamp: new Date()
                }
            };
        } catch (err) {
            throw err;
        }
    }

    public async cleanAssetsAsync(): Promise<void> {
        const assets = (await this.client.listAssets().toAllPromise()).data.items;

        for (const asset of assets) {
            await this.client
                .deleteAsset()
                .byAssetId(asset.id)
                .toPromise()
                .then((m) => {
                    this.processItem(asset.fileName, 'asset', asset);
                })
                .catch((error) => this.handleCleanError(error));
        }
    }

    public async cleanContentItemsAsync(): Promise<void> {
        const contentItems = (await this.client.listContentItems().toAllPromise()).data.items;

        for (const contentItem of contentItems) {
            await this.client
                .deleteContentItem()
                .byItemId(contentItem.id)
                .toPromise()
                .then((response) => {
                    this.processItem(contentItem.name, 'contentItem', contentItem);
                })
                .catch((error) => this.handleCleanError(error));
        }
    }

    public async cleanLanguageVariantsAsync(contentItemId: string): Promise<void> {
        const languageVariants = (await this.client.listLanguageVariantsOfItem().byItemId(contentItemId).toPromise())
            .data.items;

        for (const languageVariant of languageVariants) {
            const languageId = languageVariant.language.id;
            const itemId = contentItemId;

            if (!languageId) {
                throw Error(`Missing language id for item '${contentItemId}'`);
            }

            await this.client
                .deleteLanguageVariant()
                .byItemId(itemId)
                .byLanguageId(languageId)
                .toPromise()
                .then((response) => {
                    this.processItem(itemId, 'languageVariant', languageVariant);
                })
                .catch((error) => this.handleCleanError(error));
        }
    }

    private handleCleanError(error: any): void {
        handleError(error);
    }

    private processItem(title: string, type: ItemType, data: any): void {
        if (!this.config.onDelete) {
            return;
        }

        this.config.onDelete({
            data,
            title,
            type
        });
    }
}
