export interface ExternalIdGenerator {
    readonly assetExternalId: (codename: string) => string;
    readonly contentItemExternalId: (codename: string) => string;
}

export const defaultExternalIdGenerator: ExternalIdGenerator = {
    assetExternalId: (codename) => `asset_${codename}`,
    contentItemExternalId: (codename) => `item_${codename}`
};
