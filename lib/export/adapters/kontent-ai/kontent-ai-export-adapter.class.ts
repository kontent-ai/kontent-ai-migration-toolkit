import { IContentType, IDeliveryClient, ILanguage, createDeliveryClient } from '@kontent-ai/delivery-sdk';
import {
    IExportAdapter,
    IExportAdapterResult,
    IExportAsset,
    IKontentAiExportAdapterConfig
} from '../../export.models.js';
import { exportContentItemHelper } from './helpers/export-content-item.helper.js';
import { defaultHttpService, defaultRetryStrategy } from '../../../core/global-helper.js';
import { exportAssetsHelper } from './helpers/export-assets-item.helper.js';
import { logDebug } from '../../../core/index.js';

export class KontentAiExportAdapter implements IExportAdapter {
    constructor(private config: IKontentAiExportAdapterConfig) {}

    async exportAsync(): Promise<IExportAdapterResult> {
        logDebug({ type: 'info', message: 'Environment id', partA: this.config.environmentId });
        logDebug({ type: 'info', message: 'Using Secure API', partA: this.config.isSecure ? 'true' : 'false' });
        logDebug({ type: 'info', message: 'Using Preview API', partA: this.config.isPreview ? 'true' : 'false' });

        const deliveryClient = this.getDeliveryClient();

        const allTypes = await this.getAllContentTypesAsync(deliveryClient);
        const allLanguages = await this.getAllLanguagesAsync(deliveryClient);

        const contentItemsResult = await exportContentItemHelper.exportContentItemsAsync(
            deliveryClient,
            this.config,
            allTypes,
            allLanguages
        );

        const assets: IExportAsset[] = [];

        if (this.config.exportAssets) {
            logDebug({ type: 'info', message: `Extracting assets referenced by content items` });
            assets.push(
                ...(await exportAssetsHelper.extractAssetsAsync(contentItemsResult.deliveryContentItems, allTypes))
            );
        } else {
            logDebug({ type: 'info', message: `Assets export is disabled` });
        }

        return {
            items: contentItemsResult.exportContentItems,
            assets: assets
        };
    }

    private async getAllLanguagesAsync(deliveryClient: IDeliveryClient): Promise<ILanguage[]> {
        const response = await deliveryClient.languages().toAllPromise();
        return response.data.items;
    }

    private async getAllContentTypesAsync(deliveryClient: IDeliveryClient): Promise<IContentType[]> {
        const response = await deliveryClient.types().toAllPromise();
        return response.data.items;
    }

    private getDeliveryClient(): IDeliveryClient {
        const retryStrategy = this.config.retryStrategy ?? defaultRetryStrategy;

        return createDeliveryClient({
            environmentId: this.config.environmentId,
            retryStrategy: retryStrategy,
            httpService: defaultHttpService,
            previewApiKey: this.config.previewApiKey,
            secureApiKey: this.config.secureApiKey,
            defaultQueryConfig: {
                usePreviewMode: this.config.isPreview ? true : false,
                useSecuredMode: this.config.isSecure ? true : false
            },
            proxy: {
                baseUrl: this.config.baseUrl
            }
        });
    }
}
