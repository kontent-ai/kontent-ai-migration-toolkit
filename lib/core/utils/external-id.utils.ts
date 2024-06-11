export interface ExternalIdGenerator {
    assetExternalId: (codename: string) => string;
    contentItemExternalId: (codename: string) => string;
}

export const defaultExternalIdGenerator: ExternalIdGenerator = {
    assetExternalId: (codename) => `asset_${codename}`,
    contentItemExternalId: (codename) => `item_${codename}`
};
