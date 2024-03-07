import { IContentType, IDeliveryClient, ILanguage, createDeliveryClient } from '@kontent-ai/delivery-sdk';
import { IExportAdapter, IExportAdapterResult, IKontentAiExportAdapterConfig } from '../../export.models.js';
import colors from 'colors';
import { defaultHttpService, defaultRetryStrategy } from '../../../core/global-helper.js';
import { getExportAssetsHelper } from './helpers/export-assets.helper.js';
import { getExportContentItemHelper } from './helpers/export-content-item.helper.js';
import { ManagementClient } from '@kontent-ai/management-sdk';

export class KontentAiExportAdapter implements IExportAdapter {
    public readonly name: string = 'kontentAi';

    constructor(private config: IKontentAiExportAdapterConfig) {}

    async exportAsync(): Promise<IExportAdapterResult> {
        this.config.log.console?.({
            type: 'info',
            message: `Preparing export from environment ${colors.yellow(this.config.environmentId)}`
        });
        this.config.log.console?.({
            type: 'info',
            message: this.config.isSecure ? `Using Secure API` : `Not using Secure API`
        });
        this.config.log.console?.({
            type: 'info',
            message: this.config.isPreview ? `Using Preview API` : `Using Delivery API`
        });

        const deliveryClient = this.getDeliveryClient();
        const managementClient = this.getManagementClient();

        const allTypes = await this.getAllContentTypesAsync(deliveryClient);
        const allLanguages = await this.getAllLanguagesAsync(deliveryClient);
        const exportAssetsHelper = getExportAssetsHelper(managementClient, this.config.log);
        const exportContentItemsHelper = getExportContentItemHelper(deliveryClient, this.config.log);

        const { deliveryContentItems } = await exportContentItemsHelper.exportContentItemsAsync({
            config: this.config,
            languages: allLanguages,
            types: allTypes
        });

        this.config.log.console?.({ type: 'info', message: `Extracting assets referenced by content items` });
        const { allAssets, migrationAssets } = await exportAssetsHelper.extractAssetsAsync(
            deliveryContentItems,
            allTypes
        );

        return {
            items: exportContentItemsHelper.mapToMigrationItems({
                config: this.config,
                items: deliveryContentItems,
                languages: allLanguages,
                types: allTypes,
                assets: allAssets
            }),
            assets: migrationAssets
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

    private getManagementClient(): ManagementClient {
        const retryStrategy = this.config.retryStrategy ?? defaultRetryStrategy;

        return new ManagementClient({
            environmentId: this.config.environmentId,
            retryStrategy: retryStrategy,
            httpService: defaultHttpService,
            apiKey: this.config.managementApiKey
        });
    }
}
