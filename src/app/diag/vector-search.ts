import { VectorStore } from 'langchain/vectorstores/base';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { Callbacks } from 'langchain/callbacks';
import { Document } from 'langchain/document';
import { nanoid } from 'nanoid';

export interface AzureCogDocument extends Record<string, unknown> {}

export interface FaqDocumentIndex extends AzureCogDocument {
    id: string;
    user: string;
    embedding?: number[];
    pageContent: string;
    metadata: any;
}

type DocumentSearchModel = {
    '@search.score': number;
};

interface AzureSearchConfig {
    name: string;
    indexName: string;
    apiKey: string;
    apiVersion: string;
    vectorFieldName: string;

    adminApiKey?: string;
}

interface DocumentSearchResponseModel<TModel> {
    value: TModel[];
}

type AzureCogVectorField = {
    value: number[];
    fields: string;
    k: number;
};

type AzureCogFilter = {
    search?: string;
    facets?: string[];
    filter?: string;
    top?: number;
    vectorFields: string;
};

type AzureCogRequestObject = {
    search: string;
    facets: string[];
    filter: string;
    vectors: AzureCogVectorField[];
    top: number;
};

export type DocumentIndexStats = {
    documentCount: number;
    storageSize: number;
    vectorIndexSize: number;
};

const initVectorStore = () => {
    const azureSearch = new AzureCogSearch<FaqDocumentIndex>();

    return azureSearch;
};

export const findRelevantDocuments = async (query: string) => {
    const vectorStore = initVectorStore();

    const relevantDocuments = await vectorStore.similaritySearchWithScore(
        query,
        3,
        {
            vectorFields: vectorStore.config.vectorFieldName,
        },
    );

    const MINIMUM_SCORE = 0.81;

    const documentsAboveMinimumScore = relevantDocuments.filter((rd) => {
        const [_, score] = rd;
        return score > MINIMUM_SCORE;
    });

    const mappedDocuments = documentsAboveMinimumScore.map((document) => {
        const [d] = document;
        return {
            pageContent: `
            File Name: ${d.metadata}
            File Content: ${d.pageContent}`,

            fileName: d.metadata,
        };
    });
    return mappedDocuments;
};


class AzureCogSearch<
    TModel extends Record<string, unknown>,
> extends VectorStore {
    private _config: AzureSearchConfig;

    constructor(dbConfig?: Partial<AzureSearchConfig>) {
        const config = {
            name: process.env.AZURE_SEARCH_NAME!,
            indexName: process.env.AZURE_SEARCH_INDEX_NAME ?? 'azure-chatgpt',
            apiKey:
                process.env.AZURE_SEARCH_KEY ??
                process.env.AZURE_SEARCH_ADMIN_KEY!,
            apiVersion:
                process.env.AZURE_SEARCH_API_VERSION ?? '2023-07-01-Preview',
            vectorFieldName:
                process.env.AZURE_SEARCH_VECTOR_FIELD_NAME ?? 'embedding',
            adminApiKey: process.env.AZURE_SEARCH_ADMIN_KEY!,
            ...(dbConfig || {}),
        };
        super(new OpenAIEmbeddings(), config);
        this._config = config;
    }

    _vectorstoreType(): string {
        return 'azure-cog-search';
    }

    get config(): AzureSearchConfig {
        return this._config;
    }

    get baseUrl(): string {
        return `https://${this._config.name}.search.windows.net/indexes/${this._config.indexName}/docs`;
    }

    get baseIndexUrl(): string {
        return `https://${this._config.name}.search.windows.net/indexes/${this._config.indexName}`;
    }

    async addDocuments(documents: Document<TModel>[]): Promise<string[]> {
        const texts = documents.map(({ pageContent }) => pageContent);
        return this.addVectors(
            await this.embeddings.embedDocuments(texts),
            documents,
        );
    }

    async trackCall<T>(name: string, call: () => Promise<T>): Promise<T> {
        return call();
        // return await trackDependencyCall(
        //     'AzCogSearch',
        //     name,
        //     `${this._config.name} / ${name}`,
        //     new URL(this.baseUrl).host,
        //     call,
        // );
    }

    /**
     * Search for the most similar documents to a query
     */
    async similaritySearch(
        query: string,
        k?: number,
        filter?: AzureCogFilter,
    ): Promise<(Document<TModel> & DocumentSearchModel)[]> {
        const embeddings = await this.trackCall(
            'embedQuery',
            async () => await this.embeddings.embedQuery(query),
        );
        const results = await this.similaritySearchVectorWithScore(
            embeddings,
            k || 4,
            filter,
        );

        return results.map(([doc, _score]) => doc);
    }

    /**
     * Search for the most similar documents to a query,
     * and return their similarity score
     */
    async similaritySearchWithScore(
        query: string,
        k?: number,
        filter?: AzureCogFilter,
        _callbacks: Callbacks | undefined = undefined,
    ): Promise<[Document<TModel>, number][]> {
        const embeddings = await this.trackCall(
            'embedQuery',
            async () => await this.embeddings.embedQuery(query),
        );
        return this.similaritySearchVectorWithScore(embeddings, k || 5, filter);
    }

    /**
     * Advanced: Add more documents to an existing VectorStore,
     * when you already have their embeddings
     */
    async addVectors(
        vectors: number[][],
        documents: Document<TModel>[],
    ): Promise<string[]> {
        const indexes: Array<any> = [];

        documents.forEach((document, i) => {
            indexes.push({
                id: nanoid(),
                ...document,
                pageContent: document.pageContent,
                [this._config.vectorFieldName]: vectors[i],
            });
        });

        const documentIndexRequest: DocumentSearchResponseModel<TModel> = {
            value: indexes,
        };

        const url = `${this.baseUrl}/index?api-version=${this._config.apiVersion}`;

        const responseObj = await this.fetcher(
            url,
            documentIndexRequest,
            this._config.adminApiKey!,
        );
        return responseObj.value.map((doc: any) => doc.key);
    }

    /**
     * Advanced: Search for the most similar documents to a query,
     * when you already have the embedding of the query
     */
    async similaritySearchVectorWithScore(
        query: number[],
        k: number,
        filter?: AzureCogFilter,
    ): Promise<[Document<TModel> & DocumentSearchModel, number][]> {
        return await this.trackCall(
            'similaritySearchVectorWithScore',
            async () => {
                const url = `${this.baseUrl}/search?api-version=${this._config.apiVersion}`;

                const searchBody: AzureCogRequestObject = {
                    search: filter?.search || '*',
                    facets: filter?.facets || [],
                    filter: filter?.filter || '',
                    vectors: [
                        {
                            value: query,
                            fields: filter?.vectorFields || '',
                            k: k,
                        },
                    ],
                    top: filter?.top || k,
                };

                const resultDocuments = (await this.fetcher(
                    url,
                    searchBody,
                    this._config.apiKey,
                )) as DocumentSearchResponseModel<
                    Document<TModel> & DocumentSearchModel
                >;

                return resultDocuments.value.map((doc) => [
                    doc,
                    doc['@search.score'] || 0,
                ]);
            },
        );
    }

    async getAllSearchIds(): Promise<Array<string>> {
        return await this.trackCall('getAllSearchIds', async () => {
            const url = `${this.baseUrl}/search?api-version=${this._config.apiVersion}`;
            const searchBody = {
                search: '*',
                select: 'id',
                top: 500,
            };

            const resultDocuments = await this.fetcher(
                url,
                searchBody,
                this._config.apiKey,
            );

            return resultDocuments.value.map((doc: any) => doc.id);
        });
    }

    async deleteSearchItemsByIds(searchIds: Array<string>) {
        return await this.trackCall('deleteSearchItemsByIds', async () => {
            const url = `${this.baseUrl}/index?api-version=${this._config.apiVersion}`;
            const innerValues = searchIds.map((id) => {
                return {
                    '@search.action': 'delete',
                    id: id,
                };
            });
            const searchBody = {
                value: innerValues,
            };

            if (!this._config.adminApiKey) {
                throw new Error('adminApiKey must be provided');
            }

            await this.fetcher(url, searchBody, this._config.adminApiKey);
        });
    }

    async getIndexStats(): Promise<DocumentIndexStats> {
        return await this.trackCall('getIndexStats', async () => {
            const url = `${this.baseIndexUrl}/stats?api-version=${this._config.apiVersion}`;
            if (!this._config.adminApiKey) {
                throw new Error('adminApiKey must be provided');
            }

            const response = await this.fetcherGET(
                url,
                this._config.adminApiKey,
            );
            return response;
        });
    }

    async handleResponse(url: string, response: Response) {
        if (!response.ok) {
            const e = await response.json();
            const bestMessage =
                e?.error?.message ?? e?.error?.code ?? e?.error ?? e;

            // settings are loaded in https://github.com/hwchase17/langchainjs/blob/d017e0dac9d84c9d58fd816698125ab0ae1c0826/langchain/src/embeddings/openai.ts#L72 - show details to console to assist debugging
            const {
                name,
                indexName,
                apiKey,
                apiVersion,
                vectorFieldName,
                adminApiKey,
            } = this._config;
            const showKeys = process.env.DANGER_SHOW_KEYS_IN_ERRORS === 'true';
            const errorMessage = `Azure Cognitive Search call failed.
    check environment variables:
      name: ${name} -- AZURE_SEARCH_NAME
      indexName: ${indexName} -- AZURE_SEARCH_INDEX_NAME
      apiKey: ${
          showKeys ? apiKey : apiKey ? 'has value' : 'no value'
      } -- AZURE_SEARCH_KEY
      apiVersion: ${apiVersion} -- AZURE_SEARCH_API_VERSION
      vectorFieldName: ${vectorFieldName} -- AZURE_SEARCH_VECTOR_FIELD_NAME
      adminApiKey: ${
          showKeys ? adminApiKey : adminApiKey ? 'has value' : 'no value'
      } -- AZURE_SEARCH_ADMIN_KEY
  `;
            console.error(errorMessage, bestMessage, url);
            throw new Error(`${e?.toString()} - ${bestMessage}`);
        }

        return await response.json();
    }

    async fetcher(url: string, body: any, apiKey: string) {
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey,
            },
            cache: 'no-store',
        });
        return await this.handleResponse(url, response);
    }

    async fetcherGET(url: string, apiKey: string) {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey,
            },
            cache: 'no-store',
        });
        return await this.handleResponse(url, response);
    }
}
