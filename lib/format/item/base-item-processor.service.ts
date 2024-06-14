import { ItemFormatService, ItemsTransformData, ItemsParseData, FileBinaryData } from '../../zip/zip.models.js';
import {
    FlattenedContentType,
    FlattenedContentTypeElement,
    MigrationItem,
    exitProgram
} from '../../core/index.js';
import chalk from 'chalk';

export abstract class BaseItemProcessorService implements ItemFormatService {
    abstract readonly name: string;
    abstract transformAsync(data: ItemsTransformData): Promise<FileBinaryData>;
    abstract parseAsync(data: ItemsParseData): Promise<MigrationItem[]>;

    protected getElement(
        types: FlattenedContentType[],
        contentItemType: string,
        elementCodename: string
    ): FlattenedContentTypeElement {
        const type = types.find((m) => m.contentTypeCodename.toLowerCase() === contentItemType.toLowerCase());

        if (!type) {
            exitProgram({
                message: `Could not find content type '${chalk.red(contentItemType)}'`
            });
        }

        const element = type.elements.find((m) => m.codename.toLowerCase() === elementCodename.toLowerCase());

        if (!element) {
            exitProgram({
                message: `Could not find element with codename '${chalk.red(
                    elementCodename
                )}' for type '${chalk.yellow(type.contentTypeCodename)}'`
            });
        }

        return element;
    }
}
