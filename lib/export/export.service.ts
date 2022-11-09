import {
    ContentItemContracts,
    LanguageVariantContracts,
    ManagementClient,
    AssetContracts,
    LanguageContracts,
    ProjectContracts} from '@kontent-ai/management-sdk';
import { HttpService } from '@kontent-ai/core-sdk';

import { IExportAllResult, IExportConfig, IExportData } from './export.models';
import { defaultRetryStrategy, ItemType, printProjectInfoToConsoleAsync } from '../core';
import { version } from '../../package.json';
import { green, red, yellow } from 'colors';

export class ExportService {
    private readonly client: ManagementClient;

    constructor(private config: IExportConfig) {
        this.client = new ManagementClient({
            apiKey: config.apiKey,
            projectId: config.projectId,
            baseUrl: config.baseUrl,
            httpService: new HttpService({
                logErrorsToConsole: false
            }),
            retryStrategy: config.retryStrategy ?? defaultRetryStrategy
        });
    }

    public async exportAllAsync(): Promise<IExportAllResult> {
        const exportItems = {
            asset: this.config.exportFilter?.includes('asset') ?? true,
            binaryFile: this.config.exportFilter?.includes('binaryFile') ?? true,
            contentItem: this.config.exportFilter?.includes('contentItem') ?? true,
            languageVariant: this.config.exportFilter?.includes('languageVariant') ?? true
        };

        let projectValidation: string | ProjectContracts.IProjectReportResponseContract;
        let isInconsistentExport: boolean = false;

        await printProjectInfoToConsoleAsync(this.client);

        if (!this.config.skipValidation) {
            console.log(green('Running project validation'));
            projectValidation = await this.exportProjectValidationAsync();
            isInconsistentExport =
                projectValidation.type_issues.length > 0 || projectValidation.variant_issues.length > 0;
            console.log(
                `Project validation results: ${
                    projectValidation.type_issues.length
                        ? red(projectValidation.type_issues.length.toString())
                        : green('0')
                } type issues, ${
                    projectValidation.variant_issues.length
                        ? red(projectValidation.variant_issues.length.toString())
                        : green('0')
                } variant issues`
            );
            console.log('Projects with type or variant issues might not get imported back successfully');
        } else {
            console.log(red('Skipping project validation'));
            projectValidation = '{}';
        }

        console.log('');

        const languages = await this.getLanguagesAsync();
        const contentItems =
            exportItems.contentItem || exportItems.languageVariant ? await this.exportContentItemsAsync() : [];

        const data: IExportData = {
            contentItems: exportItems.contentItem ? await this.exportContentItemsAsync() : [],
            languageVariants: exportItems.languageVariant
                ? await this.exportLanguageVariantsAsync(contentItems, languages)
                : [],
            assets: exportItems.asset ? await this.exportAssetsAsync() : []
        };

        return {
            metadata: {
                version,
                timestamp: new Date(),
                projectId: this.config.projectId,
                isInconsistentExport,
                dataOverview: {
                    assetsCount: data.assets.length,
                    contentItemsCount: data.contentItems.length,
                    languageVariantsCount: data.languageVariants.length
                }
            },
            validation: projectValidation,
            data
        };
    }

    public async exportProjectValidationAsync(): Promise<ProjectContracts.IProjectReportResponseContract> {
        const response = await this.client.validateProjectContent().projectId(this.config.projectId).toPromise();
        return response.rawData;
    }

    public async exportAssetsAsync(): Promise<AssetContracts.IAssetModelContract[]> {
        const response = await this.client
            .listAssets()
            .withListQueryConfig({
                responseFetched: (listResponse, token) => {
                    listResponse.data.items.forEach((m) => this.processItem(m.fileName, 'asset', m));
                }
            })
            .toAllPromise();
        return response.data.items.map((m) => m._raw);
    }

    public async exportContentItemsAsync(): Promise<ContentItemContracts.IContentItemModelContract[]> {
        const response = await this.client
            .listContentItems()
            .withListQueryConfig({
                responseFetched: (listResponse, token) => {
                    listResponse.data.items.forEach((m) => this.processItem(m.name, 'contentItem', m));
                }
            })
            .toAllPromise();
        return response.data.items.map((m) => m._raw);
    }

    public async exportLanguageVariantsAsync(
        contentItems: ContentItemContracts.IContentItemModelContract[],
        languages: LanguageContracts.ILanguageModelContract[]
    ): Promise<LanguageVariantContracts.ILanguageVariantModelContract[]> {
        const languageVariants: LanguageVariantContracts.ILanguageVariantModelWithComponentsContract[] = [];

        for (const contentItem of contentItems) {
            const response = await this.client.listLanguageVariantsOfItem().byItemId(contentItem.id).toPromise();

            languageVariants.push(...response.data.items.map((m) => m._raw));

            for (const languageVariant of response.data.items) {
                const language = languages.find((m) => m.id === languageVariant.language.id);

                this.processItem(
                    `${contentItem.name} (${yellow(language?.name ?? '')})`,
                    'languageVariant',
                    languageVariant
                );
            }
        }

        return languageVariants;
    }

    private async getLanguagesAsync(): Promise<LanguageContracts.ILanguageModelContract[]> {
        const response = await this.client.listLanguages().toAllPromise();
        return response.data.items.map((m) => m._raw);
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
