import {
    CollectionModels,
    ContentItemModels,
    ManagementClient,
    SharedModels,
    WorkflowModels
} from '@kontent-ai/management-sdk';
import { version, name } from '../../package.json';

import {
    IImportedData,
    handleError,
    defaultRetryStrategy,
    printProjectAndEnvironmentInfoToConsoleAsync,
    defaultHttpService
} from '../core';
import {
    IImportConfig,
    IParsedContentItem,
    IImportSource,
    IImportContentType,
    IImportContentTypeElement
} from './import.models';
import { DeliveryClient, ElementType } from '@kontent-ai/delivery-sdk';
import { logDebug } from '../core/log-helper';
import { importAssetsHelper } from './helpers/import-assets.helper';
import { importContentItemHelper } from './helpers/import-content-item.helper';
import { importLanguageVariantHelper } from './helpers/import-language-variant.helper';

export class ImportService {
    private readonly managementClient: ManagementClient;
    private readonly deliveryClient: DeliveryClient;

    constructor(private config: IImportConfig) {
        this.managementClient = new ManagementClient({
            apiKey: config.apiKey,
            baseUrl: config.baseUrl,
            environmentId: config.environmentId,
            httpService: defaultHttpService,
            retryStrategy: config.retryStrategy ?? defaultRetryStrategy
        });
        this.deliveryClient = new DeliveryClient({
            environmentId: config.environmentId,
            secureApiKey: config.secureApiKey,
            httpService: defaultHttpService,
            defaultQueryConfig: {
                useSecuredMode: config.secureApiKey ? true : false
            },
            proxy: {
                baseUrl: config.baseUrl
            },
            retryStrategy: config.retryStrategy ?? defaultRetryStrategy
        });
    }

    async getImportContentTypesAsync(): Promise<IImportContentType[]> {
        logDebug('info', `Fetching content types from environment`);
        const contentTypes = await this.deliveryClient
            .types()
            .toAllPromise()
            .then((m) => m.data.items);
        logDebug('info', `Fetched '${contentTypes.length}' content types`);

        return contentTypes.map((contentType) => {
            const importType: IImportContentType = {
                contentTypeCodename: contentType.system.codename,
                elements: contentType.elements.map((element) => {
                    const importElement: IImportContentTypeElement = {
                        codename: element.codename ?? '',
                        type: element.type as ElementType
                    };

                    return importElement;
                })
            };

            return importType;
        });
    }

    async importFromSourceAsync(sourceData: IImportSource): Promise<IImportedData> {
        return await this.importAsync(sourceData);
    }

    async importAsync(sourceData: IImportSource): Promise<IImportedData> {
        const importedData: IImportedData = {
            assets: [],
            contentItems: [],
            languageVariants: []
        };
        await printProjectAndEnvironmentInfoToConsoleAsync(this.managementClient);

        // log information regarding version mismatch
        if (sourceData.metadata) {
            if (version !== sourceData.metadata.version) {
                console.warn(
                    `WARNING: Version mismatch. Current version of '${name}' is '${version}', but export was created using version '${sourceData.metadata.version}'.`
                );
                console.warn(
                    `Import may still succeed, but if it doesn't, please try using '${sourceData.metadata.version}' version of this library.`
                );
            }
        }

        // this is an optional step where users can exclude certain objects from being imported
        const dataToImport = this.getDataToImport(sourceData);

        // import order matters
        try {
            //  Assets
            if (dataToImport.importData.assets.length) {
                logDebug('info', `Importing assets`);
                await importAssetsHelper.importAssetsAsync(
                    this.managementClient,
                    dataToImport.importData.assets,
                    importedData
                );
            } else {
                logDebug('info', `There are no assets to import`);
            }

            // Content items
            if (dataToImport.importData.items.length) {
                logDebug('info', `Importing content items`);
                await this.importParsedContentItemsAsync(dataToImport.importData.items, importedData);
            } else {
                logDebug('info', `There are no content items to import`);
            }

            logDebug('info', `Finished import`);
        } catch (error) {
            this.handleImportError(error);
        }
        return importedData;
    }

    private getDataToImport(source: IImportSource): IImportSource {
        const dataToImport: IImportSource = {
            importData: {
                assets: [],
                items: []
            },
            metadata: source.metadata
        };

        let removedAssets: number = 0;
        let removedContentItems: number = 0;

        if (this.config?.canImport?.asset) {
            for (const asset of source.importData.assets) {
                const canImport = this.config.canImport.asset(asset);
                if (canImport) {
                    dataToImport.importData.assets.push(asset);
                    removedAssets++;
                }
            }
        } else {
            dataToImport.importData.assets = source.importData.assets;
        }

        if (this.config?.canImport?.contentItem) {
            for (const item of source.importData.items) {
                const canImport = this.config.canImport.contentItem(item);
                if (canImport) {
                    dataToImport.importData.items.push(item);
                    removedContentItems++;
                }
            }
        } else {
            dataToImport.importData.items = source.importData.items;
        }

        if (removedAssets > 0) {
            logDebug('info', `Removed '${removedAssets.toString()}' assets from import`);
        }

        if (removedContentItems) {
            logDebug('info', `Removed '${removedContentItems.toString()}' content items from import`);
        }

        return dataToImport;
    }

    private async importParsedContentItemsAsync(
        parsedContentItems: IParsedContentItem[],
        importedData: IImportedData
    ): Promise<void> {
        const workflows = await this.getWorkflowsAsync();
        const collections = await this.getCollectionsAsync();

        // first prepare content items
        const preparedContentItems: ContentItemModels.ContentItem[] =
            await importContentItemHelper.importContentItemsAsync(
                this.managementClient,
                parsedContentItems,
                collections,
                importedData,
                {
                    skipFailedItems: this.config.skipFailedItems
                }
            );

        // then process language variants
        await importLanguageVariantHelper.importLanguageVariantsAsync(
            this.managementClient,
            parsedContentItems,
            workflows,
            preparedContentItems,
            importedData,
            {
                skipFailedItems: this.config.skipFailedItems
            }
        );
    }

    private async getWorkflowsAsync(): Promise<WorkflowModels.Workflow[]> {
        return await this.managementClient
            .listWorkflows()
            .toPromise()
            .then((m) => m.data);
    }

    private async getCollectionsAsync(): Promise<CollectionModels.Collection[]> {
        return await this.managementClient
            .listCollections()
            .toPromise()
            .then((m) => m.data.collections);
    }

    private handleImportError(error: any | SharedModels.ContentManagementBaseKontentError): void {
        handleError(error);
    }
}
