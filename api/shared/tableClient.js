// Shared helper for Azure Table Storage access (Subscribers table)
const { DefaultAzureCredential, ManagedIdentityCredential } = require('@azure/identity');
const { TableClient } = require('@azure/data-tables');

function getCredential(){
  const clientId = process.env.MANAGED_IDENTITY_CLIENT_ID;
  if(clientId) return new ManagedIdentityCredential(clientId);
  return new DefaultAzureCredential();
}

function getTableClient(){
  const tableName = process.env.SUBSCRIBERS_TABLE || 'Subscribers';
  // Fast path: full storage connection string (e.g. Azurite UseDevelopmentStorage=true or real account)
  if(process.env.STORAGE_CONNECTION_STRING){
    // Use direct TableClient factory for connection string (works with Azurite and real storage)
    return TableClient.fromConnectionString(process.env.STORAGE_CONNECTION_STRING, tableName);
  }

  // For SAS or managed identity / default credential flows we need the account URL
  const accountUrl = process.env.STORAGE_ACCOUNT_TABLE_URL
    || process.env.STORAGE_ACCOUNT_BLOB_URL?.replace(/blob\./,'table.')
    || process.env.TABLES_ACCOUNT_URL;

  if(!accountUrl){
    throw new Error('Missing STORAGE_ACCOUNT_TABLE_URL (or derivable STORAGE_ACCOUNT_BLOB_URL) and no STORAGE_CONNECTION_STRING present');
  }

  if(process.env.TABLES_SAS){
    // Build URL with SAS token (no credential object needed)
    const fullUrl = `${accountUrl}/${tableName}${process.env.TABLES_SAS.startsWith('?')?process.env.TABLES_SAS:'?'+process.env.TABLES_SAS}`;
    return TableClient.fromTableUrl(fullUrl);
  }

  // Default: use managed identity / default credentials with table endpoint URL
  const credential = getCredential();
  return new TableClient(`${accountUrl}/${tableName}`, credential);
}

module.exports = { getTableClient };