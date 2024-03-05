import { IContentType, ILanguage, IContentItem, IDeliveryClient } from '@kontent-ai/delivery-sdk';
import {
    MigrationElementType,
    ItemType,
    processInChunksAsync,
    IMigrationItem,
    IMigrationElement,
    Log,
} from '../../../../core/index.js';
import { IKontentAiExportAdapterConfig } from '../../../export.models.js';
import { getElementTranslationHelper } from '../../../../translation/index.js';
import colors from 'colors';
import { AssetModels } from '@kontent-ai/management-sdk';

interface ITypeLanguageMap {
    language: ILanguage;
    type: IContentType;
}

export function getExportContentItemHelper(deliveryClient: IDeliveryClient, log?: Log): ExportContentItemHelper {
    return new ExportContentItemHelper(deliveryClient, log);
}

export class ExportContentItemHelper {
    private readonly fetchCountForTypesChunkSize: number = 100;
    private readonly exportContentItemsChunkSize: number = 100;

    constructor(private readonly deliveryClient: IDeliveryClient, private readonly log?: Log) {}

    mapToMigrationItems(data: {
        config: IKontentAiExportAdapterConfig;
        items: IContentItem[];
        types: IContentType[];
        assets: AssetModels.Asset[];
        languages: ILanguage[];
    }): IMigrationItem[] {
        return data.items.map((m) => this.maptoExportContentItem(m, data.items, data.types, data.assets, data.config));
    }

    async exportContentItemsAsync(data: {
        config: IKontentAiExportAdapterConfig;
        types: IContentType[];
        languages: ILanguage[];
    }): Promise<{ deliveryContentItems: IContentItem[] }> {
        const typesToExport: IContentType[] = this.getTypesToExport(data.config, data.types);
        const languagesToExport: ILanguage[] = this.getLanguagesToExport(data.config, data.languages);
        const contentItems: IContentItem[] = [];

        if (data.config.customItemsExport) {
            this.log?.console?.({
                type: 'info',
                message: `Using custom items export`
            });

            const customItems = await data.config.customItemsExport(this.deliveryClient);

            for (const contentItem of customItems) {
                this.log?.console?.({
                    type: 'fetch',
                    message: `${contentItem.system.name} | ${contentItem.system.type}`
                });
                contentItems.push(contentItem);
            }
        } else {
            this.log?.console?.({
                type: 'info',
                message: `Exporting content items of '${colors.yellow(
                    languagesToExport.length.toString()
                )}' content types and '${colors.yellow(languagesToExport.length.toString())}' languages`
            });

            this.log?.console?.({
                type: 'info',
                message: `Calculating total items to export`
            });

            const totalItemsToExport: number = await this.getTotalNumberOfItemsToExportAsync({
                typesToExport: typesToExport,
                languagesToExport: languagesToExport
            });
            let exportedItemsCount: number = 0;
            let extractedComponentsCount: number = 0;

            this.log?.console?.({
                type: 'info',
                message: `Found '${colors.yellow(totalItemsToExport.toString())}' items in total to export`
            });

            const typeLanguageMaps = this.getTypeLanguageMaps({
                languagesToExport: languagesToExport,
                typesToExport: typesToExport
            });

            await processInChunksAsync<ITypeLanguageMap, void>({
                log: this.log,
                type: 'contentItem',
                chunkSize: this.exportContentItemsChunkSize,
                items: typeLanguageMaps,
                processFunc: async (typeLanguageMap) => {
                    await this.deliveryClient
                        .itemsFeed()
                        .type(typeLanguageMap.type.system.codename)
                        .equalsFilter('system.language', typeLanguageMap.language.system.codename)
                        .toAllPromise({
                            responseFetched: (response) => {
                                // add items to result
                                for (const contentItem of response.data.items) {
                                    this.logItem({
                                        log: this.log,
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

            this.log?.console?.({
                type: 'info',
                message: `Adding '${colors.yellow(extractedComponentsCount.toString())}' components to export result`
            });
        }

        return {
            deliveryContentItems: contentItems
        };
    }

    private async getTotalNumberOfItemsToExportAsync(data: {
        languagesToExport: ILanguage[];
        typesToExport: IContentType[];
    }): Promise<number> {
        let totalItemsCount: number = 0;

        await processInChunksAsync<IContentType, void>({
            log: this.log,
            type: 'count',
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
                    const response = await this.deliveryClient
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
        assets: AssetModels.Asset[],
        config: IKontentAiExportAdapterConfig
    ): IMigrationItem {
        const translationHelper = getElementTranslationHelper(this.log);

        const migrationItem: IMigrationItem = {
            system: {
                codename: item.system.codename,
                name: item.system.name,
                type: item.system.type,
                language: item.system.language,
                collection: item.system.collection,
                workflow_step: item.system.workflowStep ?? undefined,
                workflow: item.system.workflow ?? undefined
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
                        types: types,
                        assets: assets
                    }),
                    type: element.type as MigrationElementType
                };

                return mappedElement;
            })
        };

        return migrationItem;
    }

    private logItem(data: {
        log: Log | undefined;
        title: string;
        index: number;
        totalCount: number;
        itemType: ItemType;
        language?: string;
    }): void {
        this.log?.spinner?.text?.({
            type: 'contentItem',
            message: `${data.title}`,
            count: {
                index: data.index,
                total: data.totalCount
            }
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
