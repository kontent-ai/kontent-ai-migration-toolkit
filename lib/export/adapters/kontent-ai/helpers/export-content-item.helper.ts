import { IContentType, ILanguage, IContentItem, IDeliveryClient } from '@kontent-ai/delivery-sdk';
import { ActionType, ContentElementType, ItemType, logDebug } from '../../../../core/index.js';
import { IKontentAiExportAdapterConfig, IExportContentItem, IExportElement } from '../../../export.models.js';
import { translationHelper } from '../../../../translation/index.js';
import colors from 'colors';

export class ExportContentItemHelper {
    async exportContentItemsAsync(
        deliveryClient: IDeliveryClient,
        config: IKontentAiExportAdapterConfig,
        types: IContentType[],
        languages: ILanguage[]
    ): Promise<{ exportContentItems: IExportContentItem[]; deliveryContentItems: IContentItem[] }> {
        const typesToExport: IContentType[] = this.getTypesToExport(config, types);
        const languagesToExport: ILanguage[] = this.getLanguagesToExport(config, languages);
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
                message: `Exporting content items of '${colors.yellow(
                    languagesToExport.length.toString()
                )}' content types & '${colors.yellow(languagesToExport.length.toString())}' languages`
            });

            for (const type of typesToExport) {
                for (const language of languagesToExport) {
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

        return {
            deliveryContentItems: contentItems,
            exportContentItems: contentItems.map((m) => this.maptoExportContentItem(m, contentItems, types, config))
        };
    }

    private maptoExportContentItem(
        item: IContentItem,
        items: IContentItem[],
        types: IContentType[],
        config: IKontentAiExportAdapterConfig
    ): IExportContentItem {
        return {
            system: {
                codename: item.system.codename,
                name: item.system.name,
                type: item.system.type,
                language: item.system.language,
                collection: item.system.collection,
                id: item.system.id,
                last_modified: item.system.lastModified,
                workflow_step: item.system.workflowStep ?? undefined
            },
            elements: Object.entries(item.elements).map(([key, element]) => {
                const mappedElement: IExportElement = {
                    codename: key,
                    value: translationHelper.transformToExportElementValue({
                        config: config.transformConfig ?? {
                            richTextConfig: {
                                replaceInvalidLinks: true
                            }
                        },
                        element: element,
                        item: item,
                        items: items,
                        types: types
                    }),
                    type: element.type as ContentElementType
                };

                return mappedElement;
            })
        };
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

    private getTypesToExport(config: IKontentAiExportAdapterConfig, types: IContentType[]): IContentType[] {
        const filteredTypes: IContentType[] = [];

        if (!config?.exportTypes?.length) {
            // export all types
            return types;
        }

        for (const type of types) {
            if (config.exportTypes.find((m) => m.toLowerCase() === type.system.codename.toLowerCase())) {
                filteredTypes.push(type);
            }
        }

        return filteredTypes;
    }

    private getLanguagesToExport(config: IKontentAiExportAdapterConfig, languages: ILanguage[]): ILanguage[] {
        const filteredLanguages: ILanguage[] = [];

        if (!config?.exportLanguages?.length) {
            // export all languages
            return languages;
        }

        for (const language of languages) {
            if (config.exportLanguages.find((m) => m.toLowerCase() === language.system.codename.toLowerCase())) {
                filteredLanguages.push(language);
            }
        }

        return filteredLanguages;
    }
}

export const exportContentItemHelper = new ExportContentItemHelper();
