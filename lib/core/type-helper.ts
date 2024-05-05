import {
    ContentTypeModels,
    ContentTypeSnippetModels,
    ContentTypeElements,
    ManagementClient
} from '@kontent-ai/management-sdk';
import { IFlattenedContentType, IFlattenedContentTypeElement } from './core.models.js';
import { Log, logErrorAndExit } from './log-helper.js';
import colors from 'colors';
import { logFetchedItems } from './global-helper.js';

export async function getFlattenedContentTypesAsync(
    managementClient: ManagementClient,
    log: Log
): Promise<IFlattenedContentType[]> {
    const contentTypes = (await managementClient.listContentTypes().toAllPromise()).data.items;

    logFetchedItems({
        count: contentTypes.length,
        itemType: 'content types',
        log: log
    });

    const contentTypeSnippets = (await managementClient.listContentTypeSnippets().toAllPromise()).data.items;

    logFetchedItems({
        count: contentTypeSnippets.length,
        itemType: 'content type snippets',
        log: log
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
        const importElement: IFlattenedContentTypeElement = {
            codename: element.codename,
            id: element.id,
            type: element.type,
            element: element
        };

        if (importElement.type === 'snippet') {
            const snippetElement = element as ContentTypeElements.ISnippetElement;

            // replace snippet element with actual elements
            const contentTypeSnippet = contentTypeSnippets.find(
                (m) => m.id.toLowerCase() === snippetElement.snippet.id?.toLowerCase()
            );

            if (!contentTypeSnippet) {
                logErrorAndExit({
                    message: `Could not find content type snippet for element. This snippet is referenced in type '${colors.red(
                        contentType.codename
                    )}'`
                });
            }

            for (const snippetElement of contentTypeSnippet.elements) {
                if (!snippetElement.codename || !snippetElement.id) {
                    continue;
                }

                elements.push({
                    codename: snippetElement.codename,
                    type: snippetElement.type,
                    id: snippetElement.id,
                    element: element
                });
            }
        } else {
            elements.push(importElement);
        }
    }

    return elements;
}
