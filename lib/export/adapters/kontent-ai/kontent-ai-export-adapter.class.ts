import { IContentType, IDeliveryClient, ILanguage, createDeliveryClient } from '@kontent-ai/delivery-sdk';
import { IExportAdapter, IExportAdapterResult, IKontentAiExportAdapterConfig } from '../../export.models.js';
import colors from 'colors';
import { defaultHttpService, defaultRetryStrategy } from '../../../core/global-helper.js';
import { getExportAssetsHelper } from './helpers/export-assets.helper.js';
import { IMigrationAsset } from '../../../core/index.js';
import { getExportContentItemHelper } from './helpers/export-content-item.helper.js';

export class KontentAiExportAdapter implements IExportAdapter {
    public readonly name: string = 'kontentAi';

    constructor(private config: IKontentAiExportAdapterConfig) {}

    async exportAsync(): Promise<IExportAdapterResult> {
        this.config.log?.({
            type: 'info',
            message: `Preparing export from environment ${colors.yellow(this.config.environmentId)}`
        });
        this.config.log?.({
            type: 'info',
            message: this.config.isSecure ? `Using Secure API` : `Not using Secure API`
        });
        this.config.log?.({
            type: 'info',
            message: this.config.isPreview ? `Using Preview API` : `Using Delivery API`
        });

        const deliveryClient = this.getDeliveryClient();

        const allTypes = await this.getAllContentTypesAsync(deliveryClient);
        const allLanguages = await this.getAllLanguagesAsync(deliveryClient);
        const exportAssetsHelper = getExportAssetsHelper(this.config.log);

        const contentItemsResult = await getExportContentItemHelper(this.config.log).exportContentItemsAsync(
            deliveryClient,
            this.config,
            allTypes,
            allLanguages
        );

        const assets: IMigrationAsset[] = [];

        if (this.config.exportAssets) {
            this.config.log?.({ type: 'info', message: `Extracting assets referenced by content items` });
            assets.push(
                ...(await exportAssetsHelper.extractAssetsAsync(contentItemsResult.deliveryContentItems, allTypes))
            );
        } else {
            this.config.log?.({ type: 'info', message: `Assets export is disabled` });
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
