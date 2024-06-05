export interface IExternalIdGenerator {
    assetExternalId: (codename: string) => string;
    contentItemExternalId: (codename: string) => string;
}

export const defaultExternalIdGenerator: IExternalIdGenerator = {
    assetExternalId: (codename) => `asset_${codename}`,
    contentItemExternalId: (codename) => `item_${codename}`
};
