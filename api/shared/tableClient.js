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
  const accountUrl = process.env.STORAGE_ACCOUNT_TABLE_URL || process.env.STORAGE_ACCOUNT_BLOB_URL?.replace(/blob\./,'table.') || process.env.TABLES_ACCOUNT_URL;
  if(!accountUrl) throw new Error('Missing STORAGE_ACCOUNT_TABLE_URL or STORAGE_ACCOUNT_BLOB_URL (to derive) for Table endpoint');
  const credential = (process.env.STORAGE_CONNECTION_STRING || process.env.TABLES_SAS) ? null : getCredential();
  if(process.env.TABLES_SAS){
    const { AzureSASCredential } = require('@azure/data-tables');
    return TableClient.fromTableUrl(`${accountUrl}/${tableName}${process.env.TABLES_SAS.startsWith('?')?process.env.TABLES_SAS:'?'+process.env.TABLES_SAS}`);
  }
  if(process.env.STORAGE_CONNECTION_STRING){
    const { TableServiceClient } = require('@azure/data-tables');
    const tsc = TableServiceClient.fromConnectionString(process.env.STORAGE_CONNECTION_STRING);
    return tsc.getTableClient(tableName);
  }
  return new TableClient(`${accountUrl}/${tableName}`, credential);
}

module.exports = { getTableClient };