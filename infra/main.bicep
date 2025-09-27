// Deploys:
// - Azure Static Web App (Standard) with system-assigned managed identity
// - Storage Account (private) + Blob container for prayer-times.json
// - Role assignment: SWA identity -> Storage Blob Data Contributor on the Storage Account
// - Function app settings on SWA to point the API to the storage blob

@description('Short name/prefix for resources (lowercase, 3-12 chars recommended). Used to derive names.')
param namePrefix string

@description('Azure location for resources.')
param location string = resourceGroup().location

@description('SWA SKU: Standard recommended (identity and private endpoints eligible).')
@allowed([
  'Free'
  'Standard'
])
param sku string = 'Standard'

@description('Blob container name that stores the prayer times JSON.')
param containerName string = 'prayer-times'

@description('Blob file name containing the prayer times JSON.')
param blobName string = 'prayer-times.json'

var prefixSanitized = toLower(replace(replace(namePrefix, '_', ''), '-', ''))
var unique = uniqueString(resourceGroup().id)
var staticSiteName = '${prefixSanitized}-swa-${unique}'
// Storage account name must be 3-24 lowercase letters and numbers
var storageAccountNameBase = '${prefixSanitized}${unique}'
var storageAccountName = toLower(substring(storageAccountNameBase, 0, 24))

resource sa 'Microsoft.Storage/storageAccounts@2024-01-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2024-01-01' = {
  name: 'default'
  parent: sa
  properties: {}
}

resource container 'Microsoft.Storage/storageAccounts/blobServices/containers@2024-01-01' = {
  name: containerName
  parent: blobService
  properties: {
    publicAccess: 'None'
  }
}

resource swa 'Microsoft.Web/staticSites@2024-04-01' = {
  name: staticSiteName
  location: location
  sku: {
    name: sku
    tier: sku
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    buildProperties: {}
    allowConfigFileUpdates: true
    enterpriseGradeCdnStatus: 'Disabled'
    stagingEnvironmentPolicy: 'Enabled'
  }
}

// App settings for the Functions runtime inside SWA
var storageBlobEndpoint = 'https://${sa.name}.blob.${environment().suffixes.storage}'
var storageTableEndpoint = 'https://${sa.name}.table.${environment().suffixes.storage}'

resource swaFunctionSettings 'Microsoft.Web/staticSites/config@2022-03-01' = {
  name: 'functionappsettings'
  parent: swa
  properties: {
    STORAGE_ACCOUNT_BLOB_URL: storageBlobEndpoint
    STORAGE_ACCOUNT_TABLE_URL: storageTableEndpoint
    PRAYER_TIMES_CONTAINER: containerName
    PRAYER_TIMES_BLOB: blobName
  }
}

// Assign Storage Blob Data Contributor to the SWA managed identity at the storage account scope
var storageBlobDataContributorRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
// Storage Table Data Contributor role id
var storageTableDataContributorRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '0a9a7e1f-bde5-4f95-b11b-0c8e944b753d')

resource swaToStorageRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(sa.id, storageBlobDataContributorRoleId, 'swa-mi')
  scope: sa
  properties: {
    roleDefinitionId: storageBlobDataContributorRoleId
    principalId: swa.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Grant Table Data Contributor so managed identity can create/read Azure Tables
resource swaToStorageTableRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(sa.id, storageTableDataContributorRoleId, 'swa-mi-table')
  scope: sa
  properties: {
    roleDefinitionId: storageTableDataContributorRoleId
    principalId: swa.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output staticWebAppName string = swa.name
output staticWebAppHostname string = swa.properties.defaultHostname
output storageAccountName string = sa.name
output storageBlobEndpoint string = storageBlobEndpoint
output storageTableEndpoint string = storageTableEndpoint
output prayerTimesContainer string = containerName
output prayerTimesBlob string = blobName
