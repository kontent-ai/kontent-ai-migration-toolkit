import { describe, expect, it } from 'vitest';
import { richTextProcessor as _richTextProcessor, CodenameReplaceFunc, ItemStateInTargetEnvironmentByCodename } from '../lib/index.js';

const richTextProcessor = _richTextProcessor();

describe('Translate ids in rich text processor', () => {
    it('Asset id should be translated', () => {
        const result = richTextProcessor.processAssetIds(
            `<figure data-asset-id=\"id\"><img src=\"#\" data-asset-id=\"id\"></figure>`,
            (id) => ({
                codename: `${id}-x`
            })
        );
        expect(result.html).toStrictEqual(`<figure data-asset-codename=\"id-x\"><img src=\"#\" data-asset-codename=\"id-x\"></figure>`);
        expect(result.ids).toStrictEqual(new Set(['id']));
    });

    it('Item id should be translated', () => {
        const result = richTextProcessor.processDataIds(
            `<object type=\"application/kenticocloud\" data-type=\"item\" data-id=\"id\"></object>`,
            (id) => ({
                codename: `${id}-x`
            })
        );
        expect(result.html).toStrictEqual(`<object type=\"application/kenticocloud\" data-type=\"item\" data-codename=\"id-x\"></object>`);
        expect(result.ids).toStrictEqual(new Set(['id']));
    });

    it('Link asset id should be translated', () => {
        const result = richTextProcessor.processLinkAssetIds(`<a data-asset-id=\"id\">link to an asset</a>`, (id) => ({
            codename: `${id}-x`
        }));
        expect(result.html).toStrictEqual(`<a data-asset-codename=\"id-x\">link to an asset</a>`);
        expect(result.ids).toStrictEqual(new Set(['id']));
    });

    it('Link item id should be translated', () => {
        const result = richTextProcessor.processLinkItemIds(`<a data-item-id=\"id\">link to a content item</a>`, (id) => ({
            codename: `${id}-x`
        }));
        expect(result.html).toStrictEqual(`<a data-item-codename=\"id-x\">link to a content item</a>`);
        expect(result.ids).toStrictEqual(new Set(['id']));
    });
});

describe('Translate codenames in rich text processor', () => {
    it('Asset codename should be translated', () => {
        const result = richTextProcessor.processAssetCodenames(
            `<figure data-asset-codename=\"codename\"><img src=\"#\" data-asset-codename=\"codename\"></figure>`,
            (codename) => {
                const replaceRes: ItemStateInTargetEnvironmentByCodename = {
                    externalIdToUse: `${codename}-x`,
                    itemCodename: codename,
                    item: undefined,
                    state: 'doesNotExists'
                };

                return replaceRes;
            }
        );
        expect(result.html).toStrictEqual(
            `<figure data-asset-external-id=\"codename-x\"><img src=\"#\" data-asset-external-id=\"codename-x\"></figure>`
        );
        expect(result.codenames).toStrictEqual(new Set(['codename']));
    });

    it('Item codename should be translated', () => {
        const result = richTextProcessor.processItemCodenames(
            `<object type=\"application/kenticocloud\" data-type=\"item\" data-codename=\"codename\"></object>`,
            (codename) => {
                const replaceRes: ItemStateInTargetEnvironmentByCodename = {
                    externalIdToUse: `${codename}-x`,
                    itemCodename: codename,
                    item: undefined,
                    state: 'doesNotExists'
                };

                return replaceRes;
            }
        );
        expect(result.html).toStrictEqual(
            `<object type=\"application/kenticocloud\" data-type=\"item\" data-external-id=\"codename-x\"></object>`
        );
        expect(result.codenames).toStrictEqual(new Set(['codename']));
    });

    it('Link asset codename should be translated', () => {
        const result = richTextProcessor.processLinkAssetCodenames(
            `<a data-asset-codename=\"codename\">link to an asset</a>`,
            (codename) => {
                const replaceRes: ItemStateInTargetEnvironmentByCodename = {
                    externalIdToUse: `${codename}-x`,
                    itemCodename: codename,
                    item: undefined,
                    state: 'doesNotExists'
                };

                return replaceRes;
            }
        );
        expect(result.html).toStrictEqual(`<a data-asset-external-id=\"codename-x\">link to an asset</a>`);
        expect(result.codenames).toStrictEqual(new Set(['codename']));
    });

    it('Link item codename should be translated', () => {
        const result = richTextProcessor.processLinkItemCodenames(
            `<a data-item-codename=\"codename\">link to a content item</a>`,
            (codename) => {
                const replaceRes: ItemStateInTargetEnvironmentByCodename = {
                    externalIdToUse: `${codename}-x`,
                    itemCodename: codename,
                    item: undefined,
                    state: 'doesNotExists'
                };

                return replaceRes;
            }
        );
        expect(result.html).toStrictEqual(`<a data-item-external-id=\"codename-x\">link to a content item</a>`);
        expect(result.codenames).toStrictEqual(new Set(['codename']));
    });
});

describe('Special caces', () => {
    it('Link item id should be translated when text contains line breaks', () => {
        const result = richTextProcessor.processLinkItemIds(`<a data-item-id=\"id\">\nlink to a content item</a>`, (id) => ({
            codename: `${id}-x`
        }));
        expect(result.html).toStrictEqual(`<a data-item-codename=\"id-x\">\nlink to a content item</a>`);
        expect(result.ids).toStrictEqual(new Set(['id']));
    });

    it('Link asset id should be translated when text contains line breaks', () => {
        const result = richTextProcessor.processLinkAssetIds(`<a data-asset-id=\"id\">\nlink to an asset</a>`, (id) => ({
            codename: `${id}-x`
        }));
        expect(result.html).toStrictEqual(`<a data-asset-codename=\"id-x\">\nlink to an asset</a>`);
        expect(result.ids).toStrictEqual(new Set(['id']));
    });

    it('Link asset id should be translated when text contains line breaks', () => {
        const result = richTextProcessor.processLinkAssetIds(`<a data-asset-id=\"id\">\nlink to an asset</a>`, (id) => ({
            codename: `${id}-x`
        }));
        expect(result.html).toStrictEqual(`<a data-asset-codename=\"id-x\">\nlink to an asset</a>`);
        expect(result.ids).toStrictEqual(new Set(['id']));
    });

    it('Link asset id should be translated when text contains line breaks', () => {
        const result = richTextProcessor.processLinkAssetIds(`<a data-asset-id=\"id\">\nlink to an asset</a>`, (id) => ({
            codename: `${id}-x`
        }));
        expect(result.html).toStrictEqual(`<a data-asset-codename=\"id-x\">\nlink to an asset</a>`);
        expect(result.ids).toStrictEqual(new Set(['id']));
    });
});
