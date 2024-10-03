import { AssetFolderModels, AssetModels, CollectionModels, LanguageModels } from '@kontent-ai/management-sdk';
import deepEqual from 'deep-equal';
import { MigrationAsset, MigrationAssetDescription, findRequired, geSizeInBytes } from '../../core/index.js';

export function shouldUpdateAsset(data: {
    readonly migrationAsset: MigrationAsset;
    readonly targetAsset: Readonly<AssetModels.Asset>;
    readonly collections: readonly Readonly<CollectionModels.Collection>[];
    readonly languages: readonly Readonly<LanguageModels.LanguageModel>[];
    readonly assetFolders: readonly Readonly<AssetFolderModels.AssetFolder>[];
}): boolean {
    return (
        !isInSameCollection(data) ||
        !areDescriptionsIdentical(data) ||
        !isTitleIdentical(data) ||
        !isFolderIdentical(data) ||
        !isBinaryFileIdentical(data)
    );
}

export function shouldReplaceBinaryFile(data: {
    readonly migrationAsset: MigrationAsset;
    readonly targetAsset: Readonly<AssetModels.Asset>;
}): boolean {
    return !isBinaryFileIdentical(data);
}

function isBinaryFileIdentical(data: {
    readonly migrationAsset: MigrationAsset;
    readonly targetAsset: Readonly<AssetModels.Asset>;
}): boolean {
    const sourceFileSize = geSizeInBytes(data.migrationAsset.binary_data);
    const targetFileSize = data.targetAsset.size;

    const sourceFilename = data.migrationAsset.filename;
    const targetFilename = data.targetAsset.fileName;

    return sourceFileSize === targetFileSize && sourceFilename === targetFilename;
}

function isFolderIdentical(data: {
    readonly migrationAsset: MigrationAsset;
    readonly targetAsset: Readonly<AssetModels.Asset>;
    readonly assetFolders: readonly Readonly<AssetFolderModels.AssetFolder>[];
}): boolean {
    return data.assetFolders.find((m) => m.id === data.targetAsset.folder?.id)?.codename === data.migrationAsset.folder?.codename;
}

function isTitleIdentical(data: { readonly migrationAsset: MigrationAsset; readonly targetAsset: Readonly<AssetModels.Asset> }): boolean {
    const sourceTitle = data.migrationAsset.title?.length ? data.migrationAsset.title : undefined;
    const targetTitle = data.targetAsset.title?.length ? data.targetAsset.title : undefined;

    return sourceTitle === targetTitle;
}

function isInSameCollection(data: {
    readonly migrationAsset: MigrationAsset;
    readonly targetAsset: Readonly<AssetModels.Asset>;
    readonly collections: readonly Readonly<CollectionModels.Collection>[];
}): boolean {
    return (
        data.collections.find((m) => m.id === data.targetAsset.collection?.reference?.id)?.codename ===
        data.migrationAsset.collection?.codename
    );
}

function areDescriptionsIdentical(data: {
    readonly migrationAsset: MigrationAsset;
    readonly targetAsset: Readonly<AssetModels.Asset>;
    readonly languages: readonly Readonly<LanguageModels.LanguageModel>[];
}): boolean {
    const sourceMigrationDescriptions = (data.migrationAsset.descriptions ?? [])
        .map<MigrationAssetDescription>((description) => {
            return {
                description: description.description?.length ? description.description : undefined,
                language: {
                    codename: description.language.codename
                }
            };
        })
        .toSorted();
    const targetMigrationDescriptions = mapToMigrationDescriptions(data).toSorted();

    return deepEqual(sourceMigrationDescriptions, targetMigrationDescriptions);
}

function mapToMigrationDescriptions(data: {
    readonly targetAsset: Readonly<AssetModels.Asset>;
    readonly languages: readonly Readonly<LanguageModels.LanguageModel>[];
}): MigrationAssetDescription[] {
    return data.targetAsset.descriptions.map((description) => {
        const languageId = description.language.id;

        return {
            description: description.description?.length ? description.description : undefined,
            language: {
                codename: findRequired(
                    data.languages,
                    (language) => language.id === languageId,
                    `Could not find language with id '${languageId}'`
                ).codename
            }
        };
    });
}
