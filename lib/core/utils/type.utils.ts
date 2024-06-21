import { ContentTypeModels, ContentTypeSnippetModels, ManagementClient } from '@kontent-ai/management-sdk';
import { FlattenedContentType, FlattenedContentTypeElement } from '../models/core.models.js';
import chalk from 'chalk';
import { runMapiRequestAsync } from './run.utils.js';
import { exitProgram, isNotUndefined } from './global.utils.js';
import { Logger } from '../models/log.models.js';

export async function getFlattenedContentTypesAsync(
    managementClient: Readonly<ManagementClient>,
    logger: Logger
): Promise<readonly FlattenedContentType[]> {
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
            const importType: FlattenedContentType = {
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
    contentTypeSnippets: readonly ContentTypeSnippetModels.ContentTypeSnippet[]
): readonly FlattenedContentTypeElement[] {
    return contentType.elements
        .flatMap((element) => {
            if (!element.codename || !element.id) {
                return undefined;
            }

            if (element.type === 'guidelines') {
                return undefined;
            }

            if (element.type === 'snippet') {
                const snippetElement = element;

                // replace snippet element with actual elements
                const contentTypeSnippet = contentTypeSnippets.find(
                    (m) => m.id.toLowerCase() === snippetElement.snippet.id?.toLowerCase()
                );

                if (!contentTypeSnippet) {
                    exitProgram({
                        message: `Could not find content type snippet for element. This snippet is referenced in type '${chalk.red(
                            contentType.codename
                        )}'`
                    });
                }

                return contentTypeSnippet.elements.map((snippetElement) => {
                    if (snippetElement.type === 'guidelines' || snippetElement.type === 'snippet') {
                        return undefined;
                    }
                    if (!snippetElement.codename || !snippetElement.id) {
                        return undefined;
                    }

                    const flattenedElement: FlattenedContentTypeElement = {
                        codename: snippetElement.codename,
                        type: snippetElement.type,
                        id: snippetElement.id,
                        element: element
                    };

                    return flattenedElement;
                });
            }
            const flattenedElement: FlattenedContentTypeElement = {
                codename: element.codename,
                id: element.id,
                type: element.type,
                element: element
            };

            return flattenedElement;
        })
        .filter(isNotUndefined);
}
