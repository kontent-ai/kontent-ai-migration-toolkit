import { HttpService } from '@kontent-ai/core-sdk';
import {
    createDeliveryClient,
    Elements,
    ElementType,
    IContentItem,
    IContentType,
    IDeliveryClient,
    ILanguage
} from '@kontent-ai/delivery-sdk';

import { IExportAllResult, IExportConfig, IExportData, IExportedAsset } from './export.models';
import { ActionType, defaultRetryStrategy, extractAssetIdFromUrl, getExtension, ItemType } from '../core';
import { version } from '../../package.json';
import { createManagementClient } from '@kontent-ai/management-sdk';
import { logDebug } from '../core/log-helper';

export class ExportService {
    private readonly httpService: HttpService = new HttpService({
        logErrorsToConsole: false
    });

    private readonly deliveryClient: IDeliveryClient;

    constructor(private config: IExportConfig) {
        const retryStrategy = config.retryStrategy ?? defaultRetryStrategy;

        this.deliveryClient = createDeliveryClient({
            environmentId: config.environmentId,
            retryStrategy: retryStrategy,
            httpService: this.httpService,
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
        const contentItems = await this.exportContentItemsAsync(types, languages);

        let assets: IExportedAsset[] = [];

        if (this.config.exportAssets) {
            logDebug('info', `Extracting assets referenced by content items`);

            assets = await this.extractAssetsAsync(contentItems, types);
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

    private getTypesToExport(types: IContentType[]): IContentType[] {
        const filteredTypes: IContentType[] = [];

        if (!this.config?.exportTypes?.length) {
            // export all types
            return types;
        }

        for (const type of types) {
            if (this.config.exportTypes.find((m) => m.toLowerCase() === type.system.codename.toLowerCase())) {
                // content type can be exported
                filteredTypes.push(type);
            }
        }

        return filteredTypes;
    }

    private async exportContentItemsAsync(types: IContentType[], languages: ILanguage[]): Promise<IContentItem[]> {
        const typesToExport: IContentType[] = this.getTypesToExport(types);
        const contentItems: IContentItem[] = [];

        if (this.config.customItemsExport) {
            logDebug('info', `Using custom items export`);

            const customItems = await this.config.customItemsExport(this.deliveryClient);

            for (const contentItem of customItems) {
                this.logItem(`${contentItem.system.name} | ${contentItem.system.type}`, 'contentItem', 'fetch', {
                    language: contentItem.system.language
                });
                contentItems.push(contentItem);
            }
        } else {
            logDebug(
                'info',
                `Exporting content items of types`,
                typesToExport.map((m) => m.system.codename).join(', ')
            );

            for (const type of typesToExport) {
                for (const language of languages) {
                    await this.deliveryClient
                        .items()
                        .type(type.system.codename)
                        .equalsFilter('system.language', language.system.codename)
                        .depthParameter(0)
                        .toAllPromise({
                            responseFetched: (response) => {
                                // add items to result
                                for (const contentItem of response.data.items) {
                                    this.logItem(`${contentItem.system.name}`, 'contentItem', 'fetch', {
                                        language: contentItem.system.language
                                    });
                                    contentItems.push(contentItem);
                                }

                                // add components to result
                                for (const [codename, contentItem] of Object.entries(response.data.linkedItems)) {
                                    if (!contentItems.find((m) => m.system.codename === codename)) {
                                        this.logItem(`${contentItem.system.name}`, 'component', 'fetch', {
                                            language: contentItem.system.language
                                        });
                                        contentItems.push(contentItem);
                                    }
                                }
                            }
                        });
                }
            }
        }

        return contentItems;
    }

    private async getLanguagesAsync(): Promise<ILanguage[]> {
        const response = await this.deliveryClient.languages().toAllPromise();
        return response.data.items;
    }

    private async getContentTypesAsync(): Promise<IContentType[]> {
        const response = await this.deliveryClient.types().toAllPromise();
        return response.data.items;
    }

    private logItem(
        title: string,
        itemType: ItemType,
        actionType: ActionType,
        data: {
            language?: string;
        }
    ): void {
        logDebug(actionType, title, itemType, data.language);
    }

    private async extractAssetsAsync(items: IContentItem[], types: IContentType[]): Promise<IExportedAsset[]> {
        const assets: IExportedAsset[] = [];

        for (const type of types) {
            const itemsOfType: IContentItem[] = items.filter((m) => m.system.type === type.system.codename);

            for (const element of type.elements) {
                if (!element.codename) {
                    continue;
                }
                if (element.type === ElementType.Asset) {
                    for (const item of itemsOfType) {
                        const assetElement = item.elements[element.codename] as Elements.AssetsElement;

                        if (assetElement.value.length) {
                            assets.push(
                                ...assetElement.value.map((m) => {
                                    const assetId = extractAssetIdFromUrl(m.url);
                                    const extension = getExtension(m.url) ?? '';
                                    const asset: IExportedAsset = {
                                        url: m.url,
                                        assetId: assetId,
                                        filename: `${assetId}.${extension}`,
                                        extension: extension
                                    };

                                    return asset;
                                })
                            );
                        }
                    }
                } else if (element.type === ElementType.RichText) {
                    for (const item of itemsOfType) {
                        const richTextElement = item.elements[element.codename] as Elements.RichTextElement;

                        if (richTextElement.images.length) {
                            assets.push(
                                ...richTextElement.images.map((m) => {
                                    const assetId = extractAssetIdFromUrl(m.url);
                                    const extension = getExtension(m.url) ?? '';
                                    const asset: IExportedAsset = {
                                        url: m.url,
                                        assetId: assetId,
                                        filename: `${assetId}.${extension}`,
                                        extension: extension
                                    };

                                    return asset;
                                })
                            );
                        }
                    }
                }
            }
        }

        const uniqueAssets = [...new Map(assets.map((item) => [item.url, item])).values()]; // filters unique values

        if (this.config.fetchAssetDetails === true) {
            if (!this.config.apiKey) {
                throw Error(`Management API key is required to fetch asset details`);
            }

            const managementClient = createManagementClient({
                apiKey: this.config.apiKey,
                environmentId: this.config.environmentId,
                retryStrategy: this.config.retryStrategy ?? defaultRetryStrategy
            });

            for (const asset of uniqueAssets) {
                const assetResponse = await managementClient.viewAsset().byAssetId(asset.assetId).toPromise();

                logDebug('info', 'Fetched asset details', asset.assetId, assetResponse.data.fileName);

                asset.filename = assetResponse.data.fileName;
            }
        }

        return uniqueAssets;
    }
}
