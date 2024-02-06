import { IContentType, ILanguage, IContentItem, IDeliveryClient } from '@kontent-ai/delivery-sdk';
import {
    MigrationElementType,
    ItemType,
    logDebug,
    logProcessingDebug,
    processInChunksAsync,
    IMigrationItem,
    IMigrationElement
} from '../../../../core/index.js';
import { IKontentAiExportAdapterConfig } from '../../../export.models.js';
import { translationHelper } from '../../../../translation/index.js';
import colors from 'colors';

interface ITypeLanguageMap {
    language: ILanguage;
    type: IContentType;
}

export class ExportContentItemHelper {
    private readonly fetchCountForTypesChunkSize: number = 100;
    private readonly exportContentItemsChunkSize: number = 100;

    async exportContentItemsAsync(
        deliveryClient: IDeliveryClient,
        config: IKontentAiExportAdapterConfig,
        types: IContentType[],
        languages: ILanguage[]
    ): Promise<{ exportContentItems: IMigrationItem[]; deliveryContentItems: IContentItem[] }> {
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
                logDebug({
                    type: 'fetch',
                    message: `${contentItem.system.name} | ${contentItem.system.type}`,
                    partA: contentItem.system.language
                });
                contentItems.push(contentItem);
            }
        } else {
            logDebug({
                type: 'info',
                message: `Exporting content items of '${colors.yellow(
                    languagesToExport.length.toString()
                )}' content types and '${colors.yellow(languagesToExport.length.toString())}' languages`
            });

            logDebug({
                type: 'info',
                message: `Calculating total items to export`
            });

            const totalItemsToExport: number = await this.getTotalNumberOfItemsToExportAsync({
                typesToExport: typesToExport,
                deliveryClient: deliveryClient,
                languagesToExport: languagesToExport
            });
            let exportedItemsCount: number = 0;
            let extractedComponentsCount: number = 0;

            logDebug({
                type: 'info',
                message: `Found '${colors.yellow(totalItemsToExport.toString())}' items in total to export`
            });

            const typeLanguageMaps = this.getTypeLanguageMaps({
                languagesToExport: languagesToExport,
                typesToExport: typesToExport
            });

            await processInChunksAsync<ITypeLanguageMap, void>({
                chunkSize: this.exportContentItemsChunkSize,
                items: typeLanguageMaps,
                processFunc: async (typeLanguageMap) => {
                    await deliveryClient
                        .itemsFeed()
                        .type(typeLanguageMap.type.system.codename)
                        .equalsFilter('system.language', typeLanguageMap.language.system.codename)
                        .toAllPromise({
                            responseFetched: (response) => {
                                // add items to result
                                for (const contentItem of response.data.items) {
                                    this.logItem({
                                        index: exportedItemsCount + 1,
                                        totalCount: totalItemsToExport,
                                        title: contentItem.system.name,
                                        language: contentItem.system.language,
                                        itemType: 'contentItem'
                                    });
                                    contentItems.push(contentItem);
                                    exportedItemsCount++;
                                }

                                // add components to result
                                for (const [codename, contentItem] of Object.entries(response.data.linkedItems)) {
                                    if (!contentItems.find((m) => m.system.codename === codename)) {
                                        contentItems.push(contentItem);
                                        extractedComponentsCount++;
                                    }
                                }
                            }
                        });
                }
            });

            logDebug({
                type: 'info',
                message: `Adding '${colors.yellow(extractedComponentsCount.toString())}' components to export result`
            });
        }

        return {
            deliveryContentItems: contentItems,
            exportContentItems: contentItems.map((m) => this.maptoExportContentItem(m, contentItems, types, config))
        };
    }

    private async getTotalNumberOfItemsToExportAsync(data: {
        deliveryClient: IDeliveryClient;
        languagesToExport: ILanguage[];
        typesToExport: IContentType[];
    }): Promise<number> {
        let totalItemsCount: number = 0;

        await processInChunksAsync<IContentType, void>({
            chunkSize: this.fetchCountForTypesChunkSize,
            itemInfo: (type) => {
                return {
                    itemType: 'count',
                    title: type.system.name,
                    partA: type.system.codename
                };
            },
            items: data.typesToExport,
            processFunc: async (type) => {
                for (const language of data.languagesToExport) {
                    const response = await data.deliveryClient
                        .items()
                        .type(type.system.codename)
                        .equalsFilter('system.language', language.system.codename)
                        .limitParameter(1)
                        .depthParameter(0)
                        .includeTotalCountParameter()
                        .toPromise();
                    totalItemsCount += response.data.pagination.totalCount ?? 0;
                }
            }
        });

        return totalItemsCount;
    }

    private maptoExportContentItem(
        item: IContentItem,
        items: IContentItem[],
        types: IContentType[],
        config: IKontentAiExportAdapterConfig
    ): IMigrationItem {
        const migrationItem: IMigrationItem = {
            system: {
                codename: item.system.codename,
                name: item.system.name,
                type: item.system.type,
                language: item.system.language,
                collection: item.system.collection,
                last_modified: item.system.lastModified,
                workflow_step: item.system.workflowStep ?? undefined
            },
            elements: Object.entries(item.elements).map(([key, element]) => {
                const mappedElement: IMigrationElement = {
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
                    type: element.type as MigrationElementType
                };

                return mappedElement;
            })
        };

        return migrationItem;
    }

    private logItem(data: {
        title: string;
        index: number;
        totalCount: number;
        itemType: ItemType;
        language?: string;
    }): void {
        logProcessingDebug({
            itemType: data.itemType,
            title: `${data.title}`,
            index: data.index,
            totalCount: data.totalCount,
            partA: data.language
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

    private getTypeLanguageMaps(data: {
        typesToExport: IContentType[];
        languagesToExport: ILanguage[];
    }): ITypeLanguageMap[] {
        const maps: ITypeLanguageMap[] = [];

        for (const type of data.typesToExport) {
            for (const language of data.languagesToExport) {
                maps.push({
                    type: type,
                    language: language
                });
            }
        }

        return maps;
    }
}

export const exportContentItemHelper = new ExportContentItemHelper();
