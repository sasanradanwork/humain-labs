// HumAIn Labs infrastructure: Azure Static Web App (site + managed API),
// a serverless Azure Cosmos DB for NoSQL account holding the data, and
// Azure Communication Services for verification emails.
//
//   az group create -n humain-labs-rg -l uksouth
//   az deployment group create -g humain-labs-rg -f infra/main.bicep

@description('Short name used to build resource names (lowercase letters and numbers).')
@minLength(3)
@maxLength(12)
param name string = 'humainlabs'

@description('Region for Cosmos DB.')
param location string = resourceGroup().location

@description('Region for the Static Web App. Static Web Apps are only offered in some regions.')
@allowed([ 'westeurope', 'eastus2', 'centralus', 'westus2', 'eastasia' ])
param swaLocation string = 'westeurope'

@description('Free works for launch. Standard is needed for custom sign-in providers such as LinkedIn.')
@allowed([ 'Free', 'Standard' ])
param swaSku string = 'Free'

var suffix = take(uniqueString(resourceGroup().id), 8)
var databaseName = 'humain'
var containers = [
  { name: 'researchers', partitionKey: '/id' }
  { name: 'participants', partitionKey: '/id' }
  { name: 'groups', partitionKey: '/id' }
  { name: 'studies', partitionKey: '/id' }
  { name: 'applications', partitionKey: '/studyId' }
]

resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: '${name}-db-${suffix}'
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    consistencyPolicy: { defaultConsistencyLevel: 'Session' }
    locations: [ { locationName: location, failoverPriority: 0, isZoneRedundant: false } ]
    capabilities: [ { name: 'EnableServerless' } ]
    minimalTlsVersion: 'Tls12'
  }
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  parent: cosmos
  name: databaseName
  properties: { resource: { id: databaseName } }
}

resource containerResources 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = [for c in containers: {
  parent: database
  name: c.name
  properties: {
    resource: {
      id: c.name
      partitionKey: { paths: [ c.partitionKey ], kind: 'Hash' }
    }
  }
}]

@description('Where Azure Communication Services stores email data.')
@allowed([ 'UK', 'Europe', 'United States' ])
param emailDataLocation string = 'UK'

// Email for researcher verification codes. Starts with an Azure-managed sender
// domain (DoNotReply@<random>.azurecomm.net); you can connect your own domain later.
resource emailService 'Microsoft.Communication/emailServices@2023-04-01' = {
  name: '${name}-email-${suffix}'
  location: 'global'
  properties: { dataLocation: emailDataLocation }
}

resource emailDomain 'Microsoft.Communication/emailServices/domains@2023-04-01' = {
  parent: emailService
  name: 'AzureManagedDomain'
  location: 'global'
  properties: { domainManagement: 'AzureManaged', userEngagementTracking: 'Disabled' }
}

resource communication 'Microsoft.Communication/communicationServices@2023-04-01' = {
  name: '${name}-acs-${suffix}'
  location: 'global'
  properties: {
    dataLocation: emailDataLocation
    linkedDomains: [ emailDomain.id ]
  }
}

resource site 'Microsoft.Web/staticSites@2023-01-01' = {
  name: '${name}-web-${suffix}'
  location: swaLocation
  sku: { name: swaSku, tier: swaSku }
  properties: {}
}

resource siteSettings 'Microsoft.Web/staticSites/config@2023-01-01' = {
  parent: site
  name: 'appsettings'
  properties: {
    COSMOS_ENDPOINT: cosmos.properties.documentEndpoint
    COSMOS_KEY: cosmos.listKeys().primaryMasterKey
    COSMOS_DATABASE: databaseName
    ACS_CONNECTION_STRING: communication.listKeys().primaryConnectionString
    EMAIL_SENDER: 'DoNotReply@${emailDomain.properties.mailFromSenderDomain}'
  }
}

output siteUrl string = 'https://${site.properties.defaultHostname}'
output staticWebAppName string = site.name
output cosmosAccountName string = cosmos.name
