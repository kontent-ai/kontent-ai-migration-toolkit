import {
    ContentTypeModels,
    ContentTypeSnippetModels,
    ContentTypeElements,
    ManagementClient
} from '@kontent-ai/management-sdk';
import { FlattenedContentType, FlattenedContentTypeElement } from '../models/core.models.js';
import chalk from 'chalk';
import { runMapiRequestAsync } from './run.utils.js';
import { MigrationElementType } from '../models/migration.models.js';
import { exitProgram } from './global.utils.js';
import { Logger } from '../models/log.models.js';

export async function getFlattenedContentTypesAsync(
    managementClient: ManagementClient,
    logger: Logger
): Promise<FlattenedContentType[]> {
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
    contentTypeSnippets: ContentTypeSnippetModels.ContentTypeSnippet[]
): FlattenedContentTypeElement[] {
    const elements: FlattenedContentTypeElement[] = [];

    for (const element of contentType.elements) {
        if (!element.codename || !element.id) {
            continue;
        }

        const migrationElementType = mapToMigrationElementType(element);
        if (!migrationElementType) {
            continue;
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

            for (const snippetElement of contentTypeSnippet.elements) {
                if (!snippetElement.codename || !snippetElement.id) {
                    continue;
                }

                const migrationElementType = mapToMigrationElementType(snippetElement);
                if (!migrationElementType) {
                    continue;
                }

                const flattenedElement: FlattenedContentTypeElement = {
                    codename: snippetElement.codename,
                    type: migrationElementType,
                    id: snippetElement.id,
                    element: element
                };

                elements.push(flattenedElement);
            }
        } else {
            const flattenedElement: FlattenedContentTypeElement = {
                codename: element.codename,
                id: element.id,
                type: migrationElementType,
                element: element
            };

            elements.push(flattenedElement);
        }
    }

    return elements;
}

function mapToMigrationElementType(
    element: ContentTypeElements.ContentTypeElementModel
): MigrationElementType | undefined {
    if (element.type === 'guidelines' || element.type === 'snippet') {
        return undefined;
    }
    return element.type;
}
