const { TableClient, TableServiceClient } = require('@azure/data-tables');
const { getSpecificTableClient } = require('./tableClient');

function getEventsTable(){
  const name = process.env.EVENTS_TABLE_NAME || 'Events';
  if(process.env.STORAGE_CONNECTION_STRING){
    return TableClient.fromConnectionString(process.env.STORAGE_CONNECTION_STRING, name);
  }
  return getSpecificTableClient(name);
}

async function ensureEventsTableExists(){
  const name = process.env.EVENTS_TABLE_NAME || 'Events';
  // Try a quick list to see if we get a 404
  const client = getEventsTable();
  try {
    const iter = client.listEntities({ queryOptions:{ top:1 } });
    await iter.next();
    return client; // exists
  } catch(e){
    const notFound = (e.statusCode === 404 || e.code === 'TableNotFound' || e.code === 'ResourceNotFound');
    if(notFound && !process.env.DISABLE_AUTO_CREATE_EVENTS_TABLE){
      // Need service-level client to create table
      try {
        if(process.env.STORAGE_CONNECTION_STRING){
          const svc = TableServiceClient.fromConnectionString(process.env.STORAGE_CONNECTION_STRING);
          await svc.createTable(name);
        } else {
          const accountUrl = (process.env.STORAGE_ACCOUNT_TABLE_URL
            || process.env.STORAGE_ACCOUNT_BLOB_URL?.replace(/blob\./,'table.')
            || process.env.TABLES_ACCOUNT_URL);
          const { DefaultAzureCredential, ManagedIdentityCredential } = require('@azure/identity');
          const cred = process.env.MANAGED_IDENTITY_CLIENT_ID ? new ManagedIdentityCredential(process.env.MANAGED_IDENTITY_CLIENT_ID) : new DefaultAzureCredential();
            const svc = new TableServiceClient(accountUrl, cred);
            await svc.createTable(name);
        }
        return getEventsTable();
      } catch(inner){ throw inner; }
    }
    // If name had uppercase letters and not found, retry in lower-case (Azure tables are case-insensitive, but rarely casing issues surface in some tools)
    if(notFound && /[A-Z]/.test(name)){
      try {
        const lowerClient = getSpecificTableClient(name.toLowerCase());
        const iter = lowerClient.listEntities({ queryOptions:{ top:1 } });
        await iter.next();
        return lowerClient;
      } catch {/* ignore and rethrow original */}
    }
    throw e;
  }
}

module.exports = { getEventsTable, ensureEventsTableExists };
