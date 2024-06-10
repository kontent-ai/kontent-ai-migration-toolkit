import {
    ContentTypeModels,
    ContentTypeSnippetModels,
    ContentTypeElements,
    ManagementClient,
    ElementModels
} from '@kontent-ai/management-sdk';
import { IFlattenedContentType, IFlattenedContentTypeElement } from '../models/core.models.js';
import { ILogger, logErrorAndExit } from './log.utils.js';
import chalk from 'chalk';
import { runMapiRequestAsync } from './run.utils.js';

const excludedFlattenedElements: ElementModels.ElementType[] = ['guidelines'];

export async function getFlattenedContentTypesAsync(
    managementClient: ManagementClient,
    logger: ILogger
): Promise<IFlattenedContentType[]> {
    const contentTypes = await runMapiRequestAsync({
        logger: logger,
        func: async () => (await managementClient.listContentTypes().toAllPromise()).data.items,
        action: 'list',
        type: 'contentType'
    });

    const contentTypeSnippets = await runMapiRequestAsync({
        logger: logger,
        func: async () => (await managementClient.listContentTypeSnippets().toAllPromise()).data.items,
        action: 'list',
        type: 'contentTypeSnippet'
    });

    return [
        ...contentTypes.map((contentType) => {
            const importType: IFlattenedContentType = {
                contentTypeCodename: contentType.codename,
                contentTypeId: contentType.id,
                elements: getContentTypeElements(contentType, contentTypeSnippets)
            };

            return importType;
        })
    ];
}

function getContentTypeElements(
    contentType: ContentTypeModels.ContentType,
    contentTypeSnippets: ContentTypeSnippetModels.ContentTypeSnippet[]
): IFlattenedContentTypeElement[] {
    const elements: IFlattenedContentTypeElement[] = [];

    for (const element of contentType.elements) {
        if (!element.codename || !element.id) {
            continue;
        }
        if (excludeElement(element)) {
            continue;
        }

        if (element.type === 'snippet') {
            const snippetElement = element as ContentTypeElements.ISnippetElement;

            // replace snippet element with actual elements
            const contentTypeSnippet = contentTypeSnippets.find(
                (m) => m.id.toLowerCase() === snippetElement.snippet.id?.toLowerCase()
            );

            if (!contentTypeSnippet) {
                logErrorAndExit({
                    message: `Could not find content type snippet for element. This snippet is referenced in type '${chalk.red(
                        contentType.codename
                    )}'`
                });
            }

            for (const snippetElement of contentTypeSnippet.elements) {
                if (!snippetElement.codename || !snippetElement.id) {
                    continue;
                }
                if (excludeElement(snippetElement)) {
                    continue;
                }

                const flattenedElement: IFlattenedContentTypeElement = {
                    codename: snippetElement.codename,
                    type: snippetElement.type,
                    id: snippetElement.id,
                    element: element
                };

                elements.push(flattenedElement);
            }
        } else {
            const flattenedElement: IFlattenedContentTypeElement = {
                codename: element.codename,
                id: element.id,
                type: element.type,
                element: element
            };

            elements.push(flattenedElement);
        }
    }

    return elements;
}

function excludeElement(element: ContentTypeElements.ContentTypeElementModel): boolean {
    return excludedFlattenedElements.includes(element.type);
}
