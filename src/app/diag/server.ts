import {
    DiagnosticResult,
    FAILURE,
    SUCCESS,
} from './shared';
import { StringifyFile } from './doc-intel';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
// import { trackTrace } from '@/features/logging/unified';
import { lookup } from 'node:dns/promises';

import {
    AzureNamedKeyCredential,
    TableClient,
} from '@azure/data-tables';
import {
    BlobServiceClient,
} from '@azure/storage-blob';
import { QueueClient } from '@azure/storage-queue';
import { getSupportedDocumentFormats } from './translator';
import { findRelevantDocuments } from './vector-search';
import { getChatCompletions } from './chat-completion';

export const runDiagnostics = async (
): Promise<DiagnosticResult[]> => {
    await createResources();
    return Promise.all([
        azureStorageChatsTable(),
        azureStorageUserDocumentsBlob(),
        openAIEmbeddings(),
        openAIChatCompletionGPT35(),
        cognitiveSearch(),
        documentIntelligence(),
        documentTranslationSupportedFormats(),
        // applicationInsights(),
        applicationInsightsDirect(),
        jobQueue(),
    ]);
};

const account = process.env.STORAGE_ACCOUNT_NAME!;
const accountKey = process.env.STORAGE_ACCOUNT_KEY!;
const connectionString = `DefaultEndpointsProtocol=https;AccountName=${account};AccountKey=${accountKey};EndpointSuffix=core.windows.net`;
const tableUrl = `https://${account}.table.core.windows.net`;

const getCredential = () => new AzureNamedKeyCredential(account, accountKey);
const getChatsTableClient = () =>
    new TableClient(tableUrl, 'chats', getCredential());
const getBlobServiceClient = () =>
    BlobServiceClient.fromConnectionString(connectionString);
const getDocumentContainerClient = () =>
    getBlobServiceClient().getContainerClient('documents');
const getJobQueueQueueClient = () =>
    new QueueClient(connectionString, 'queue');

const createResources = async () => {
    await getChatsTableClient().createTable();
    await getDocumentContainerClient().createIfNotExists();
    await getJobQueueQueueClient().createIfNotExists();
}

const azureStorageChatsTable = async () =>
    runTest(
        'Azure Storage Table',
        async () => {
            let all = [];
            for await(const page of getChatsTableClient().listEntities().byPage()) {
                all.push(...page);
            }
            return all;
        },
        (threads) => `Found ${threads.length} records...`,
    );

const azureStorageUserDocumentsBlob = async () =>
    runTest(
        'Azure Storage User Documents Blob',
        async () => {
            let all = [];
            for await(const page of getChatsTableClient().listEntities().byPage()) {
                all.push(...page);
            }
            return all;
        },
        (blobs) =>
            `Found ${blobs.length} blobs...`,
    );

const openAIEmbeddings = async () =>
    runTest(
        'Open AI Embeddings',
        () => new OpenAIEmbeddings().embedQuery('test query'),
        (vector) =>
            `Got vector of length ${vector.length} - first 3: ${vector
                .slice(0, 3)
                .join(', ')}`,
    );

const openAIChatCompletionGPT35 = async () =>
    runTest(
        'Open AI Chat Completion GPT-3.5',
        () =>
            getChatCompletions(
                'gpt-3.5',
                [{ role: 'system', content: 'what time is it?' }],
                { stream: false },
            ),
        (completion) => completion.choices[0].message?.content!,
    );

const cognitiveSearch = async () =>
    runTest(
        'Cognitive Search',
        () => findRelevantDocuments('random text'),
        (documents) =>
            `Found ${documents.length} document(s)` +
            (documents.length ? ` including ${documents[0]?.fileName}` : ''),
    );

const documentTranslationSupportedFormats = async () =>
    runTest(
        'Document Translation Supported Formats',
        () => getSupportedDocumentFormats(),
        (formats) => `Found ${formats.length} formats`,
    );

// base64-encoded small PDF from https://stackoverflow.com/questions/17279712/what-is-the-smallest-possible-valid-pdf#comment91728922_32142316
const pdfBase64 =
    'JVBERi0xLjIgCjkgMCBvYmoKPDwKPj4Kc3RyZWFtCkJULyA5IFRmKFRlc3QpJyBFVAplbmRzdHJlYW0KZW5kb2JqCjQgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCA1IDAgUgovQ29udGVudHMgOSAwIFIKPj4KZW5kb2JqCjUgMCBvYmoKPDwKL0tpZHMgWzQgMCBSIF0KL0NvdW50IDEKL1R5cGUgL1BhZ2VzCi9NZWRpYUJveCBbIDAgMCA5OSA5IF0KPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1BhZ2VzIDUgMCBSCi9UeXBlIC9DYXRhbG9nCj4+CmVuZG9iagp0cmFpbGVyCjw8Ci9Sb290IDMgMCBSCj4+CiUlRU9G';
const documentIntelligence = async () =>
    runTest(
        'Document Intelligence',
        () =>
            StringifyFile(
                new Blob([Buffer.from(pdfBase64, 'base64')], {
                    type: 'application/pdf',
                }),
            ),
        ({ paragraphs, pages }) =>
            `Found ${paragraphs?.length} paragraph(s) and ${pages?.length} page(s)`,
    );

// const applicationInsights = async () =>
//     runTest(
//         'Application Insights (server)',
//         async () => {
//             if (
//                 !trackTrace({ message: 'diagnostics test message from server' })
//             )
//                 throw new Error(
//                     'Application Insights is not enabled - check that connection string is correct',
//                 );
//         },
//         () => `Sent trace message to Application Insights from server`,
//     );

const applicationInsightsDirect = async () =>
    runTest(
        'Application Insights (Direct)',
        async () => {
            const connectionString =
                process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
            if (!connectionString) throw new Error('No connection string');
            const parts = connectionString.split(';');
            const obj = Object.fromEntries(parts.map((i) => i.split('=')));
            if (!obj.InstrumentationKey)
                throw new Error('No instrumentation key configured');
            if (!obj.IngestionEndpoint)
                throw new Error('No ingestion endpoint configured');
            const ingestUrl = new URL(obj.IngestionEndpoint);
            try {
                await lookup(ingestUrl.hostname);
            } catch (e) {
                throw new Error(
                    `Error resolving ingestion endpoint (${ingestUrl.hostname}): ${e}`,
                );
            }
            let ingestData: {
                itemsReceived?: number;
                itemsAccepted?: number;
                errors?: any[];
            };
            try {
                // based on https://learn.microsoft.com/en-us/troubleshoot/azure/azure-monitor/app-insights/investigate-missing-telemetry#powershell-script-send-request-telemetry-record
                const r = await fetch(obj.IngestionEndpoint + 'v2/track', {
                    method: 'POST',
                    body: JSON.stringify({
                        name: 'direct diagnostics test message from server',
                        iKey: obj.InstrumentationKey,
                        time: new Date().toISOString(),
                        data: {
                            baseType: 'MessageData',
                            baseData: {
                                message:
                                    'direct diagnostics test message from server',
                            },
                        },
                    }),
                });
                if (!r.ok) {
                    throw new Error(
                        `Failed to fetch ingestion endpoint: ${r.status}`,
                    );
                }
                ingestData = (await r.json()) || {};
            } catch (e) {
                throw new Error(
                    `Error fetching ingestion endpoint (${obj.IngestionEndpoint}): ${e}`,
                );
            }
            if (!obj.LiveEndpoint)
                throw new Error('No live endpoint configured');
            const liveUrl = new URL(obj.LiveEndpoint);
            try {
                await lookup(liveUrl.hostname);
            } catch (e) {
                throw new Error(
                    `Error resolving live endpoint (${liveUrl.hostname}): ${e}`,
                );
            }
            return ingestData;
        },
        (data) =>
            data.itemsAccepted === 1 &&
            data.itemsReceived === 1 &&
            !data.errors?.length
                ? 'Item accepted with no errors'
                : JSON.stringify(data),
    );

const jobQueue = async () =>
    runTest(
        'Job Queue',
        async () => {
            const client = getJobQueueQueueClient();
            return (
                (
                    await client.peekMessages({
                        numberOfMessages: 32,
                    })
                )?.peekedMessageItems ?? []
            );
        },
        (jobs) => `Found ${jobs.length} in queue`,
    );

/**
 * Helpers to build diagnostic results
 */

function failure(name: string, error: any): DiagnosticResult {
    return {
        name,
        status: FAILURE,
        errorMessage: error?.message ?? error?.toString() ?? 'Unknown error',
        errorString: error?.toString() ?? 'Unknown',
    };
}

function success(name: string, result: string): DiagnosticResult {
    return {
        name,
        status: SUCCESS,
        result,
    };
}

async function runTest<T>(
    name: string,
    getData: () => Promise<T>,
    buildResult: (data: T) => string,
): Promise<DiagnosticResult> {
    try {
        const data = await getData();
        return success(name, buildResult(data));
    } catch (e: any) {
        return failure(name, e);
    }
}
