import { IContentType, ILanguage, IContentItem, IDeliveryClient } from '@kontent-ai/delivery-sdk';
import { logDebug } from '../../core/log-helper';
import { ActionType, ItemType } from '../../core';
import { IExportConfig } from '../export.models';

export class ExportContentItemHelper {
    async exportContentItemsAsync(
        deliveryClient: IDeliveryClient,
        config: IExportConfig,
        types: IContentType[],
        languages: ILanguage[]
    ): Promise<IContentItem[]> {
        const typesToExport: IContentType[] = this.getTypesToExport(config, types);
        const contentItems: IContentItem[] = [];

        if (config.customItemsExport) {
            logDebug({
                type: 'info',
                message: `Using custom items export`
            });

            const customItems = await config.customItemsExport(deliveryClient);

            for (const contentItem of customItems) {
                this.logItem(`${contentItem.system.name} | ${contentItem.system.type}`, 'contentItem', 'fetch', {
                    language: contentItem.system.language
                });
                contentItems.push(contentItem);
            }
        } else {
            logDebug({
                type: 'info',
                message: `Exporting content items of types`,
                partA: typesToExport.map((m) => m.system.codename).join(', ')
            });

            for (const type of typesToExport) {
                for (const language of languages) {
                    await deliveryClient
                        .itemsFeed()
                        .type(type.system.codename)
                        .equalsFilter('system.language', language.system.codename)
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

    private logItem(
        title: string,
        itemType: ItemType,
        actionType: ActionType,
        data: {
            language?: string;
        }
    ): void {
        logDebug({
            type: actionType,
            message: title,
            partA: itemType,
            partB: data.language
        });
    }

    private getTypesToExport(config: IExportConfig, types: IContentType[]): IContentType[] {
        const filteredTypes: IContentType[] = [];

        if (!config?.exportTypes?.length) {
            // export all types
            return types;
        }

        for (const type of types) {
            if (config.exportTypes.find((m) => m.toLowerCase() === type.system.codename.toLowerCase())) {
                // content type can be exported
                filteredTypes.push(type);
            }
        }

        return filteredTypes;
    }
}

export const exportContentItemHelper = new ExportContentItemHelper();
