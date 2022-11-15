import { IManagementClient, createManagementClient } from '@kontent-ai/management-sdk';
import { HttpService } from '@kontent-ai/core-sdk';
import { createDeliveryClient, IContentItem, IContentType, IDeliveryClient, ILanguage } from '@kontent-ai/delivery-sdk';

import { IExportAllResult, IExportConfig, IExportData } from './export.models';
import { defaultRetryStrategy, ItemType, printProjectInfoToConsoleAsync } from '../core';
import { version } from '../../package.json';
import { yellow } from 'colors';

export class ExportService {
    private readonly managementClient: IManagementClient<any>;
    private readonly deliveryClient: IDeliveryClient;

    constructor(private config: IExportConfig) {
        this.managementClient = createManagementClient({
            apiKey: config.apiKey,
            projectId: config.projectId,
            baseUrl: config.baseUrl,
            httpService: new HttpService({
                logErrorsToConsole: false
            }),
            retryStrategy: config.retryStrategy ?? defaultRetryStrategy
        });
        this.deliveryClient = createDeliveryClient({
            projectId: config.projectId,
            retryStrategy: config.retryStrategy ?? defaultRetryStrategy,
            httpService: new HttpService({
                logErrorsToConsole: false
            }),
            proxy: {
                baseUrl: config.baseUrl
            }
        });
    }

    async exportAllAsync(): Promise<IExportAllResult> {
        await printProjectInfoToConsoleAsync(this.managementClient);

        console.log('');

        const types = await this.getContentTypesAsync();
        const languages = await this.getLanguagesAsync();
        const contentItems = await this.exportContentItemsAsync(types, languages);

        const data: IExportData = {
            contentItems: contentItems,
            contentTypes: types,
            languages: languages
        };

        return {
            metadata: {
                version,
                timestamp: new Date(),
                projectId: this.config.projectId,
                dataOverview: {
                    contentItemsCount: data.contentItems.length
                }
            },
            data
        };
    }

    private async exportContentItemsAsync(types: IContentType[], languages: ILanguage[]): Promise<IContentItem[]> {
        const contentItems: IContentItem[] = [];

        for (const type of types) {
            if (this.config.exportFilter?.types?.length) {
                if (
                    this.config.exportFilter.types.find((m) => m.toLowerCase() === type.system.codename.toLowerCase())
                ) {
                    // content type can be exported
                } else {
                    // content type should not be exported
                    continue;
                }
            }
            for (const language of languages) {
                await this.deliveryClient
                    .items()
                    .equalsFilter('system.language', language.system.codename)
                    .depthParameter(0)
                    .toAllPromise({
                        responseFetched: (response) => {
                            for (const contentItem of response.data.items) {
                                this.processItem(
                                    `${contentItem.system.name} (${yellow(contentItem.system.language)})`,
                                    'contentItem',
                                    contentItem
                                );
                            }
                            contentItems.push(...response.data.items);
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

    private processItem(title: string, type: ItemType, data: any): void {
        if (!this.config.onExport) {
            return;
        }

        this.config.onExport({
            data,
            title,
            type
        });
    }
}
