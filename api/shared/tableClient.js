// Shared helper for Azure Table Storage access (Subscribers table)
const { DefaultAzureCredential, ManagedIdentityCredential } = require('@azure/identity');
const { TableClient } = require('@azure/data-tables');

function getCredential(){
  const clientId = process.env.MANAGED_IDENTITY_CLIENT_ID;
  if(clientId) return new ManagedIdentityCredential(clientId);
  return new DefaultAzureCredential();
}

function getTableClient(){
  let tableName = process.env.SUBSCRIBERS_TABLE || 'Subscribers';
  if(typeof tableName !== 'string'){
    // Defensive: coerce and log
    const coerced = String(tableName);
    console.warn('[tableClient] Non-string SUBSCRIBERS_TABLE value detected, coercing', tableName);
    tableName = coerced;
  }

  function build(kind){
    // Fast path: full storage connection string (e.g. Azurite UseDevelopmentStorage=true or real account)
    if(process.env.STORAGE_CONNECTION_STRING){
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
      const fullUrl = `${accountUrl}/${tableName}${process.env.TABLES_SAS.startsWith('?')?process.env.TABLES_SAS:'?'+process.env.TABLES_SAS}`;
      return TableClient.fromTableUrl(fullUrl);
    }
    const credential = getCredential();
    return new TableClient(`${accountUrl}/${tableName}`, credential);
  }

  try {
    return build('primary');
  } catch (e){
    const msg = e && e.message || String(e);
    // Specific defensive recovery: table name became an object somehow in production
    if(/table with value "\[object Object\]" must be of type string/i.test(msg)){
      console.warn('[tableClient] Detected object table name issue. Forcing fallback table name Subscribers. Raw env value =', process.env.SUBSCRIBERS_TABLE);
      tableName = 'Subscribers';
      try { return build('fallback'); } catch (inner){ throw inner; }
    }
    throw e;
  }
}

module.exports = { getTableClient };