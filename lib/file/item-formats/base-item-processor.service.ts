import { IItemFormatService, ItemsTransformData, ItemsParseData, FileBinaryData } from '../../zip/zip.models.js';
import {
    IFlattenedContentType,
    IFlattenedContentTypeElement,
    IMigrationItem,
    logErrorAndExit
} from '../../core/index.js';
import chalk from 'chalk';

export abstract class BaseItemProcessorService implements IItemFormatService {
    abstract readonly name: string;
    abstract transformContentItemsAsync(data: ItemsTransformData): Promise<FileBinaryData>;
    abstract parseContentItemsAsync(data: ItemsParseData): Promise<IMigrationItem[]>;

    protected getElement(
        types: IFlattenedContentType[],
        contentItemType: string,
        elementCodename: string
    ): IFlattenedContentTypeElement {
        const type = types.find((m) => m.contentTypeCodename.toLowerCase() === contentItemType.toLowerCase());

        if (!type) {
            logErrorAndExit({
                message: `Could not find content type '${chalk.red(contentItemType)}'`
            });
        }

        const element = type.elements.find((m) => m.codename.toLowerCase() === elementCodename.toLowerCase());

        if (!element) {
            logErrorAndExit({
                message: `Could not find element with codename '${chalk.red(
                    elementCodename
                )}' for type '${chalk.yellow(type.contentTypeCodename)}'`
            });
        }

        return element;
    }
}
