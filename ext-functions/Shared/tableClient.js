const { DefaultAzureCredential, ManagedIdentityCredential } = require('@azure/identity');
const { TableClient } = require('@azure/data-tables');

function credential(){
  const clientId = process.env.MANAGED_IDENTITY_CLIENT_ID;
  return clientId ? new ManagedIdentityCredential(clientId) : new DefaultAzureCredential();
}

function getTableClient(nameEnv, fallback){
  let tableName = process.env[nameEnv] || fallback;
  if(typeof tableName !== 'string') tableName = String(tableName||fallback);
  if(process.env.STORAGE_CONNECTION_STRING){
    return TableClient.fromConnectionString(process.env.STORAGE_CONNECTION_STRING, tableName);
  }
  const accountUrl = process.env.STORAGE_ACCOUNT_TABLE_URL
    || process.env.STORAGE_ACCOUNT_BLOB_URL?.replace(/blob\./,'table.')
    || process.env.TABLES_ACCOUNT_URL;
  if(!accountUrl) throw new Error('Missing storage account URL env vars');
  if(process.env.TABLES_SAS){
    const sas = process.env.TABLES_SAS.startsWith('?')?process.env.TABLES_SAS:'?'+process.env.TABLES_SAS;
    return TableClient.fromTableUrl(`${accountUrl}/${tableName}${sas}`);
  }
  return new TableClient(`${accountUrl}/${tableName}`, credential());
}

module.exports = { getSubscribersTable: ()=> getTableClient('SUBSCRIBERS_TABLE','Subscribers'), getRsvpsTable: ()=> getTableClient('RSVP_TABLE_NAME','Rsvps') };
