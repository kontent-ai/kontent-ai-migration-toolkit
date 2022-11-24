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
import { magenta, yellow } from 'colors';

export class ExportService {
    private readonly httpService: HttpService = new HttpService({
        logErrorsToConsole: false
    });

    private readonly contentItemsLimit: number = 200;

    private readonly deliveryClient: IDeliveryClient;

    constructor(private config: IExportConfig) {
        const retryStrategy = config.retryStrategy ?? defaultRetryStrategy;

        this.deliveryClient = createDeliveryClient({
            projectId: config.projectId,
            retryStrategy: retryStrategy,
            httpService: this.httpService,
            proxy: {
                baseUrl: config.baseUrl
            }
        });
    }

    async exportAllAsync(): Promise<IExportAllResult> {
        console.log(`Project: '${yellow(this.config.projectId)}'\n`);

        const types = await this.getContentTypesAsync();
        const languages = await this.getLanguagesAsync();
        const contentItems = await this.exportContentItemsAsync(types, languages);

        let assets: IExportedAsset[] = [];

        console.log('');
        if (this.config.exportAssets) {
            console.log(`Extracting assets referenced by content items`);
            assets = this.extractAssets(contentItems, types);
        } else {
            console.log(`Assets export is disabled`);
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
                projectId: this.config.projectId,
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

        console.log(
            `Exporting content items of types: ${yellow(typesToExport.map((m) => m.system.codename).join(', '))} \n`
        );

        for (const type of typesToExport) {
            for (const language of languages) {
                await this.deliveryClient
                    .items()
                    .type(type.system.codename)
                    .equalsFilter('system.language', language.system.codename)
                    .depthParameter(0)
                    .limitParameter(this.contentItemsLimit)
                    .toAllPromise({
                        responseFetched: (response) => {
                            // add items to result
                            for (const contentItem of response.data.items) {
                                this.processItem(
                                    `${contentItem.system.name} ${magenta(contentItem.system.language)}`,
                                    'contentItem',
                                    'fetch',
                                    contentItem
                                );
                                contentItems.push(contentItem);
                            }

                            // add components to result
                            for (const [codename, contentItem] of Object.entries(response.data.linkedItems)) {
                                if (!contentItems.find((m) => m.system.codename === codename)) {
                                    this.processItem(
                                        `${contentItem.system.name} ${magenta(contentItem.system.language)}`,
                                        'component',
                                        'fetch',
                                        contentItem
                                    );
                                    contentItems.push(contentItem);
                                }
                            }
                        }
                    });
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

    private processItem(title: string, itemType: ItemType, actionType: ActionType, data: any): void {
        if (!this.config.onProcess) {
            return;
        }

        this.config.onProcess({
            data,
            title,
            actionType,
            itemType
        });
    }

    private extractAssets(items: IContentItem[], types: IContentType[]): IExportedAsset[] {
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

        return [...new Map(assets.map((item) => [item.url, item])).values()]; // filters unique values
    }
}
