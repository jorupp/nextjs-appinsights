import {
    AzureKeyCredential,
    ChatMessage,
    GetChatCompletionsOptions,
    OpenAIClient,
} from '@azure/openai';

import { trackDependencyCall } from './app-insights';

export interface ChatMessageModel {
    id: string;
    createdAt: Date;
    isDeleted: boolean;
    threadId: string;
    userId: string;
    content: string;
    role: ChatRole;
    type: 'CHAT_MESSAGE';
    tokenCount?: number;
    model?: LLMModel;
}

export type ConversationStyle = 'creative' | 'balanced' | 'precise';
export type ChatType = 'simple' | 'data' | 'mssql';
export type LLMModel = 'gpt-3.5' | 'gpt-4';

export type ChatRole = 'system' | 'user' | 'assistant' | 'function';

export async function getChatCompletions(
    model: LLMModel,
    messages: ChatMessage[],
    options?: GetChatCompletionsOptions,
) {
    const {
        instanceName,
        instanceNameVariableName,
        apiKey,
        apiKeyVariableName,
        deploymentName,
        deploymentNameVariableName,
        apiVersion,
        apiVersionVariableName,
    } = getModelConfiguration(model);

    let endpoint = `https://${instanceName!}.openai.azure.com`;
    const client = new OpenAIClient(endpoint, new AzureKeyCredential(apiKey!), {
        apiVersion: apiVersion!,
    });

    try {
        return await trackDependencyCall(
            'AzOpenAI',
            'getChatCompletions',
            `${endpoint} / getChatCompletions`,
            new URL(endpoint).host,
            async () => {
                return await client.getChatCompletions(
                    deploymentName!,
                    messages,
                    options,
                );
            },
            {
                model,
                deploymentName,
            },
            (result) => ({
                completionTokens: result?.usage?.completionTokens,
                promptTokens: result?.usage?.promptTokens,
                totalTokens: result?.usage?.totalTokens,
            }),
        );
    } catch (e: any) {
        const bestMessage =
            e?.error?.message ?? e?.error?.code ?? e?.error ?? e;
        const showKeys = process.env.DANGER_SHOW_KEYS_IN_ERRORS === 'true';
        const errorMessage = `Failed to get chat completion for ${model} model.
  check environment variables:
    apiKey: ${
        showKeys ? apiKey : apiKey ? 'has value' : 'no value'
    } -- ${apiKeyVariableName}
    instanceName: ${instanceName} -- ${instanceNameVariableName}
    deploymentName: ${deploymentName} -- ${deploymentNameVariableName}
    apiVersion: ${apiVersion} -- ${apiVersionVariableName}
    `;
        console.error(errorMessage, bestMessage);
        throw new Error(`${e?.toString()} - ${bestMessage}`);
    }
}


const modelEnvironmentVariableNames = {
    ['gpt-3.5' satisfies LLMModel]: 'GPT35',
    ['gpt-4' satisfies LLMModel]: 'GPT4',
};
function getModelConfigurationValueAndName(
    model: LLMModel,
    name: string,
): [string | undefined, string] {
    const modelVariableName = `AZURE_OPENAI_${modelEnvironmentVariableNames[model]}_${name}`;
    const baseVariableName = `AZURE_OPENAI_${name}`;
    if (process.env[modelVariableName]) {
        return [process.env[modelVariableName]!, modelVariableName];
    }
    return [process.env[baseVariableName], baseVariableName];
}

export function getModelConfiguration(model: LLMModel) {
    const [instanceName, instanceNameVariableName] =
        getModelConfigurationValueAndName(model, 'API_INSTANCE_NAME');
    const [apiKey, apiKeyVariableName] = getModelConfigurationValueAndName(
        model,
        'API_KEY',
    );
    const [deploymentName, deploymentNameVariableName] =
        getModelConfigurationValueAndName(model, 'API_DEPLOYMENT_NAME');
    const [apiVersion, apiVersionVariableName] =
        getModelConfigurationValueAndName(model, 'API_VERSION');

    return {
        instanceName,
        instanceNameVariableName,
        apiKey,
        apiKeyVariableName,
        deploymentName,
        deploymentNameVariableName,
        apiVersion,
        apiVersionVariableName,
    };
}
