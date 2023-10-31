import DocumentTranslator from '@azure-rest/ai-document-translator';
import { HttpResponse } from '@azure-rest/core-client';

const endpoint = process.env.AZURE_DOCUMENT_TRANSLATOR_ENDPOINT || '';
const key = process.env.AZURE_DOCUMENT_TRANSLATOR_KEY || '';

const baseUrl = `${endpoint}/translator/text/batch/v1.1`;

const client = DocumentTranslator(endpoint, { key: key }, { baseUrl: baseUrl });

function createError(response: HttpResponse) {
    const { method, url } = response?.request || {};
    const { body, status, headers } = response || {};
    const error = (body as any)?.error || (body as any)?.Error;
    const code = error?.code || error?.code;
    const message =
        error?.message ||
        error?.Message ||
        (code ? `Error code: ${code}` : 'Unknown error');
    return new Error(message, {
        cause: { method, url, status, code, headers, body },
    });
}

export async function getSupportedDocumentFormats(): Promise<string[]> {
    const response = await client.path('/documents/formats').get();

    if (response.status !== '200') {
        throw createError(response);
    }

    const supportedFormats = response.body.value
        .map((format) =>
            format.fileExtensions.map((ext) => ext.substring(1)),
        )
        .flat();

    return supportedFormats;
}
