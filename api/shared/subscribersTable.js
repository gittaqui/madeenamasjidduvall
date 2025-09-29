const { TableClient, TableServiceClient } = require('@azure/data-tables');
const { AzureSASCredential } = require('@azure/core-auth');
const { getSpecificTableClient } = require('./tableClient');

if(process.env.TABLES_SAS_B64 && !process.env.TABLES_SAS){
  try {
    const decoded = Buffer.from(process.env.TABLES_SAS_B64, 'base64').toString('utf8');
    process.env.TABLES_SAS = decoded.startsWith('?') ? decoded : ('?'+decoded);
  } catch{}
}

function getSubscribersTable(){
  const name = process.env.SUBSCRIBERS_TABLE || 'Subscribers';
  if(process.env.STORAGE_CONNECTION_STRING){
    return TableClient.fromConnectionString(process.env.STORAGE_CONNECTION_STRING, name);
  }
  return getSpecificTableClient(name);
}

async function ensureSubscribersTableExists(){
  const name = process.env.SUBSCRIBERS_TABLE || 'Subscribers';
  const client = getSubscribersTable();
  try {
    const iter = client.listEntities({ queryOptions:{ top:1 }});
    await iter.next();
    return client;
  } catch(e){
    const notFound = (e.statusCode === 404 || e.code === 'TableNotFound' || e.code === 'ResourceNotFound');
    if(notFound && !process.env.DISABLE_AUTO_CREATE_SUBSCRIBERS_TABLE){
      try {
        if(process.env.STORAGE_CONNECTION_STRING){
          const svc = TableServiceClient.fromConnectionString(process.env.STORAGE_CONNECTION_STRING);
          await svc.createTable(name);
        } else {
          const accountUrl = (process.env.STORAGE_ACCOUNT_TABLE_URL
            || process.env.STORAGE_ACCOUNT_BLOB_URL?.replace(/blob\./,'table.')
            || process.env.TABLES_ACCOUNT_URL);
          if(process.env.TABLES_SAS){
            const raw = process.env.TABLES_SAS.startsWith('?') ? process.env.TABLES_SAS.slice(1) : process.env.TABLES_SAS;
            const cred = new AzureSASCredential(raw);
            const svc = new TableServiceClient(accountUrl, cred);
            await svc.createTable(name);
          } else {
            const { DefaultAzureCredential, ManagedIdentityCredential } = require('@azure/identity');
            const cred = process.env.MANAGED_IDENTITY_CLIENT_ID ? new ManagedIdentityCredential(process.env.MANAGED_IDENTITY_CLIENT_ID) : new DefaultAzureCredential();
            const svc = new TableServiceClient(accountUrl, cred);
            await svc.createTable(name);
          }
        }
        return getSubscribersTable();
      } catch(inner){ throw inner; }
    }
    throw e;
  }
}

module.exports = { getSubscribersTable, ensureSubscribersTableExists };
