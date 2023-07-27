import { createDeliveryClient, IContentType, IDeliveryClient, ILanguage } from '@kontent-ai/delivery-sdk';

import { IExportAllResult, IExportConfig, IExportData, IExportedAsset } from './export.models';
import { defaultRetryStrategy, defaultHttpService } from '../core';
import { version } from '../../package.json';
import { logDebug } from '../core/log-helper';
import { exportContentItemHelper } from './helpers/export-content-item.helper';
import { exportAssetsHelper } from './helpers/export-assets-item.helper';

export class ExportService {
    private readonly deliveryClient: IDeliveryClient;

    constructor(private config: IExportConfig) {
        const retryStrategy = config.retryStrategy ?? defaultRetryStrategy;

        this.deliveryClient = createDeliveryClient({
            environmentId: config.environmentId,
            retryStrategy: retryStrategy,
            httpService: defaultHttpService,
            previewApiKey: config.previewApiKey,
            secureApiKey: config.secureApiKey,
            defaultQueryConfig: {
                usePreviewMode: config.previewApiKey ? true : false,
                useSecuredMode: config.secureApiKey ? true : false
            },
            proxy: {
                baseUrl: config.baseUrl
            }
        });
    }

    async exportAllAsync(): Promise<IExportAllResult> {
        logDebug('info', `Environment id`, this.config.environmentId);

        const types = await this.getContentTypesAsync();
        const languages = await this.getLanguagesAsync();
        const contentItems = await exportContentItemHelper.exportContentItemsAsync(
            this.deliveryClient,
            this.config,
            types,
            languages
        );

        let assets: IExportedAsset[] = [];

        if (this.config.exportAssets) {
            logDebug('info', `Extracting assets referenced by content items`);

            assets = await exportAssetsHelper.extractAssetsAsync(this.config, contentItems, types);
        } else {
            logDebug('info', `Assets export is disabled`);
        }

        const data: IExportData = {
            contentItems: contentItems,
            contentTypes: types,
            languages: languages,
            assets: assets
        };

        return {
            metadata: {
                csvManagerVersion: version,
                timestamp: new Date(),
                environmentId: this.config.environmentId,
                dataOverview: {
                    contentItemsCount: data.contentItems.length,
                    assetsCount: data.assets.length
                }
            },
            data
        };
    }

    private async getLanguagesAsync(): Promise<ILanguage[]> {
        const response = await this.deliveryClient.languages().toAllPromise();
        return response.data.items;
    }

    private async getContentTypesAsync(): Promise<IContentType[]> {
        const response = await this.deliveryClient.types().toAllPromise();
        return response.data.items;
    }
}
