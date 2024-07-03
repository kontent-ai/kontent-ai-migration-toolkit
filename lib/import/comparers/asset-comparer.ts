import { AssetModels, CollectionModels, LanguageModels } from '@kontent-ai/management-sdk';
import { MigrationAsset, MigrationAssetDescription, findRequired } from '../../core/index.js';
import deepEqual from 'deep-equal';

export function shouldUpdateAsset(data: {
    migrationAsset: MigrationAsset;
    targetAsset: Readonly<AssetModels.Asset>;
    collections: readonly CollectionModels.Collection[];
    languages: readonly LanguageModels.LanguageModel[];
}): boolean {
    if (!isInSameCollection(data)) {
        return true;
    }

    if (!areDescriptionsIdentical(data)) {
        return true;
    }

    if (!isTitleIdentical(data)) {
        return true;
    }

    return false;
}

function isTitleIdentical(data: { migrationAsset: MigrationAsset; targetAsset: Readonly<AssetModels.Asset> }): boolean {
    const sourceTitle = data.migrationAsset.title?.length ? data.migrationAsset.title : undefined;
    const targetTitle = data.targetAsset.title?.length ? data.targetAsset.title : undefined;

    return sourceTitle === targetTitle;
}

function isInSameCollection(data: {
    migrationAsset: MigrationAsset;
    targetAsset: Readonly<AssetModels.Asset>;
    collections: readonly CollectionModels.Collection[];
}): boolean {
    return (
        data.collections.find((m) => m.id === data.targetAsset.collection?.reference?.id)?.codename ===
        data.migrationAsset.collection?.codename
    );
}

function areDescriptionsIdentical(data: {
    migrationAsset: MigrationAsset;
    targetAsset: Readonly<AssetModels.Asset>;
    languages: readonly LanguageModels.LanguageModel[];
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
    targetAsset: Readonly<AssetModels.Asset>;
    languages: readonly LanguageModels.LanguageModel[];
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
