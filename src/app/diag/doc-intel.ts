import {
    AzureKeyCredential,
    DocumentAnalysisClient,
} from '@azure/ai-form-recognizer';


export const initDocumentIntelligence = () => {
    const client = new DocumentAnalysisClient(
        process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT!,
        new AzureKeyCredential(process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY!),
        {
            //  apiVersion: "2022-08-31",
        },
    );

    return client;
};

export const StringifyFile = async (blob: Blob) => {
    try {
        const client = initDocumentIntelligence();
        const poller = await client.beginAnalyzeDocument(
            'prebuilt-document',
            await blob.arrayBuffer(),
        );

        return await poller.pollUntilDone();
    } catch (e: any) {
        const { url } = e?.request || {};
        const bestMessage =
            e?.details?.error?.innererror?.message ??
            e?.details?.error?.innererror?.code ??
            e?.details?.error?.message ??
            e?.details?.error?.code ??
            e?.details?.error ??
            e?.message ??
            e?.details ??
            e;

        const showKeys = process.env.DANGER_SHOW_KEYS_IN_ERRORS === 'true';
        const apiKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
        const errorMessage = `Failed to call form intelligence service.
    check environment variables:
        endpoint: ${
            process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT
        } -- AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT
        key: ${
            showKeys ? apiKey : apiKey ? 'has value' : 'no value'
        } -- AZURE_DOCUMENT_INTELLIGENCE_KEY
    `;
        console.error(errorMessage, bestMessage, url);
        throw new Error(`${e?.toString()} - ${bestMessage}`);
    }
};