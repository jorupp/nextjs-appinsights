// in order for this to be fully service-principal-createable, the service principal needs the "Cognitive Services Contributor" role assigned to it
//   https://learn.microsoft.com/en-us/azure/ai-services/multi-service-resource?tabs=windows&pivots=azportal#prerequisites
//   alternatively, you can manually pre-create the Microsoft.CognitiveServices/accounts resources with the same name/config

param location string = resourceGroup().location
@minLength(5)
param name string = 'nextjs-appinsights'
@minLength(5)
param simpleName string = replace(name, '-', '')
param openAiLocation string

param apps array = ['inst', 'manual']

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2020-10-01' = [for app in apps: {
  name: '${name}-analytics-${app}'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 90
  }
}]

resource appInsights 'Microsoft.Insights/components@2020-02-02' = [for (app, i) in apps: {
  name: '${name}-appinsights-${app}'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics[i].id
  }
}]

resource storage 'Microsoft.Storage/storageAccounts@2022-09-01' = {
  name: '${simpleName}storage'
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    publicNetworkAccess: 'Enabled'
  }
}

resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: '${name}-serviceplan'
  location: location
  kind: 'linux'
  sku:  {
  	name: 'B1'
    tier: 'Basic'
  }
  properties: {
    // per docs, this must be set to true for a linux plan (in addition to kind: linux) - https://learn.microsoft.com/en-us/azure/templates/microsoft.web/2020-12-01/serverfarms?pivots=deployment-language-bicep#appserviceplanproperties
    reserved: true
  }
}

resource webApp 'Microsoft.Web/sites@2022-09-01' = [for app in apps: {
  name: '${name}-${app}'
  location: location
  properties: {
    siteConfig: {
      acrUseManagedIdentityCreds: true
      // TODO: I wonder if we can create it with this blank so we don't later overwrite whatever image is currently deployed
      // linuxFxVersion: 'DOCKER|mcr.microsoft.com/appsvc/staticsite:latest'
    }
    serverFarmId: appServicePlan.id
    publicNetworkAccess: 'Enabled'
  }
  identity: {
    type: 'SystemAssigned'
  }
}]

resource acr 'Microsoft.ContainerRegistry/registries@2022-12-01' = {
  name: '${simpleName}reg'
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    publicNetworkAccess: 'Enabled'
  }
}

@description('This is the built-in AcrPull role. See https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles#acrpull')
resource acrPull 'Microsoft.Authorization/roleDefinitions@2022-04-01' existing = {
  scope: subscription()
  name: '7f951dda-4ed3-4680-a7ca-43fe172d538d'
}

resource acrRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (app, i) in apps: {
  name: guid('${name}-app-acr-pull-${app}')
  scope: acr
  properties: {
    principalId: webApp[i].identity.principalId
    roleDefinitionId: acrPull.id
  }
}]

resource keyVault 'Microsoft.KeyVault/vaults@2022-07-01' = {
  name: '${name}-kv'
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    accessPolicies: []
    publicNetworkAccess: 'Enabled'
  }
}

resource keyVaultAppAccess 'Microsoft.KeyVault/vaults/accessPolicies@2023-02-01' =  {
  name: 'add'
  parent: keyVault
  properties: {
    accessPolicies: [
      for (app, i) in apps: {
        tenantId: subscription().tenantId
        objectId: webApp[i].identity.principalId
        permissions: {
          secrets: [
            'get'
            'list'
          ]
        }
      }
    ]
  }
}

resource translator 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: '${name}-translator'
  location: location
  kind: 'TextTranslation'
  sku: {
    name: 'S1'
  }
  properties: {
    customSubDomainName: '${name}-translator'
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
    }
  }
  identity: {
    type: 'SystemAssigned'
  }
}

@description('This is the built-in AcrPull role. See https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles#storage-blob-data-contributor')
resource storBlobDataContrib 'Microsoft.Authorization/roleDefinitions@2022-04-01' existing = {
  scope: subscription()
  name: 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
}

resource translateRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid('${name}-stor-translate')
  scope: storage
  properties: {
    principalId: translator.identity.principalId
    roleDefinitionId: storBlobDataContrib.id
  }
}

resource docIntel 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: '${name}-docintel'
  location: location
  kind: 'FormRecognizer'
  sku: {
    name: 'S0'
  }
  properties: {
    customSubDomainName: '${name}-docintel'
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
    }
  }
}

// cognitive search
resource search 'Microsoft.Search/searchServices@2022-09-01' = {
  name: '${name}-search'
  location: location
  sku: {
    name: 'basic'
  }
}

// openai services
resource openAi 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: '${name}-openai'
  location: openAiLocation
  kind: 'OpenAI'
  sku: {
    name: 'S0'
  }
  properties: {
    customSubDomainName: '${name}-openai'
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
    }
  }
}
resource openAiGpt4Instance 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: '${name}-openai-gpt4'
  location: openAiLocation
  kind: 'OpenAI'
  sku: {
    name: 'S0'
  }
  properties: {
    customSubDomainName: '${name}-openai-gpt4'
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
    }
  }
}

// TODO: figure out why all calls to create/update these model deployments fails saying there's an existing operation in progress
resource openAiGpt35 'Microsoft.CognitiveServices/accounts/deployments@2023-05-01' = {
  parent: openAi
  name: 'gpt-35-turbo'
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-35-turbo'
      version: '0613'
    }
  }
  sku: {
    name: 'Standard'
    capacity: 20
  }
}
resource openAiGpt4 'Microsoft.CognitiveServices/accounts/deployments@2023-05-01' = {
  parent: openAiGpt4Instance
  name: 'gpt-4'
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-4'
      version: '0613'
    }
  }
  sku: {
    name: 'Standard'
    capacity: 20
  }
}
resource openAiEmbedding 'Microsoft.CognitiveServices/accounts/deployments@2023-05-01' = {
  parent: openAi
  name: 'text-embedding-ada-002'
  properties: {
    model: {
      format: 'OpenAI'
      name: 'text-embedding-ada-002'
      version: '2'
    }
  }
}

// store secrets in keyvault
resource secretStorageKey 'Microsoft.KeyVault/vaults/secrets@2022-07-01' = {
  parent: keyVault
  name: 'STORAGE-ACCOUNT-KEY'
  properties: {
    value: storage.listKeys().keys[0].value
  }
}
resource secretDocIntelKey 'Microsoft.KeyVault/vaults/secrets@2022-07-01' = {
  parent: keyVault
  name: 'AZURE-DOCUMENT-INTELLIGENCE-KEY'
  properties: {
    value: docIntel.listKeys().key1
  }
}
resource secretTranslateKey 'Microsoft.KeyVault/vaults/secrets@2022-07-01' = {
  parent: keyVault
  name: 'AZURE-DOCUMENT-TRANSLATOR-KEY'
  properties: {
    value: translator.listKeys().key1
  }
}
resource secretSearchKey 'Microsoft.KeyVault/vaults/secrets@2022-07-01' = {
  parent: keyVault
  name: 'AZURE-SEARCH-ADMIN-KEY'
  properties: {
    value: search.listAdminKeys().primaryKey
  }
}
resource secretOpenAiKey 'Microsoft.KeyVault/vaults/secrets@2022-07-01' = {
  parent: keyVault
  name: 'AZURE-OPENAI-API-KEY'
  properties: {
    value: openAi.listKeys().key1
  }
}
resource gpt4ApiKeySecret 'Microsoft.KeyVault/vaults/secrets@2022-07-01' = {
  parent: keyVault
  name: 'AZURE-OPENAI-GPT4-API-KEY'
  properties: {
    value: openAiGpt4Instance.listKeys().key1
  }
}

// web app settings
resource webAppSettings 'Microsoft.Web/sites/config@2021-02-01' = [for (app, i) in apps: {
  name: 'web'
  parent: webApp[i]
  properties: {
    appSettings: [
      { name: 'WEBSITES_PORT', value: '3000' }
      { name: 'AZURE_OPENAI_API_KEY', value: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=AZURE-OPENAI-API-KEY)' }
      { name: 'AZURE_SEARCH_ADMIN_KEY', value: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=AZURE-SEARCH-ADMIN-KEY)' }
      { name: 'STORAGE_ACCOUNT_KEY', value: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=STORAGE-ACCOUNT-KEY)' }
      { name: 'AZURE_DOCUMENT_INTELLIGENCE_KEY', value: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=AZURE-DOCUMENT-INTELLIGENCE-KEY)' }
      { name: 'AZURE_DOCUMENT_TRANSLATOR_KEY', value: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=AZURE-DOCUMENT-TRANSLATOR-KEY)' }
      { name: 'AZURE_OPENAI_GPT4_API_KEY', value: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=AZURE-OPENAI-GPT4-API-KEY)' }
      { name: 'AZURE_OPENAI_API_INSTANCE_NAME', value: openAi.name }
      { name: 'AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME', value: openAiEmbedding.name }
      { name: 'AZURE_OPENAI_API_VERSION', value: '2023-03-15-preview' }
      { name: 'AZURE_OPENAI_GPT35_API_DEPLOYMENT_NAME', value: openAiGpt35.name }
      { name: 'AZURE_OPENAI_GPT4_API_INSTANCE_NAME', value: openAiGpt4Instance.name }
      { name: 'AZURE_OPENAI_GPT4_API_DEPLOYMENT_NAME', value: openAiGpt4.name }
      { name: 'ADMIN_ROLE_NAME', value: 'Admin' }
      { name: 'AZURE_SEARCH_NAME', value: search.name }
      { name: 'STORAGE_ACCOUNT_NAME', value: storage.name }
      { name: 'AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT', value: docIntel.properties.endpoint }
      { name: 'AZURE_DOCUMENT_TRANSLATOR_ENDPOINT', value: translator.properties.endpoints.DocumentTranslation }
      { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights[i].properties.ConnectionString }
    ]
  }
}]
