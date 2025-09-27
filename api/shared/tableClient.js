// Shared helper for Azure Table Storage access (Subscribers table)
// Enhanced to log which authentication path is used (connection string, SAS, or Managed Identity/default credentials)
const { DefaultAzureCredential, ManagedIdentityCredential } = require('@azure/identity');
const { TableClient } = require('@azure/data-tables');

let _lastAuthMode = null; // cached for diagnostics endpoint usage

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

  function build(){
    // 1. Full connection string (local dev or legacy secret-based) – least preferred in production
    if(process.env.STORAGE_CONNECTION_STRING){
      _lastAuthMode = 'connection_string';
      return TableClient.fromConnectionString(process.env.STORAGE_CONNECTION_STRING, tableName);
    }
    // 2. URL + SAS token
    const accountUrl = process.env.STORAGE_ACCOUNT_TABLE_URL
      || process.env.STORAGE_ACCOUNT_BLOB_URL?.replace(/blob\./,'table.')
      || process.env.TABLES_ACCOUNT_URL;
    if(!accountUrl){
      throw new Error('Missing STORAGE_ACCOUNT_TABLE_URL (or derivable STORAGE_ACCOUNT_BLOB_URL) and no STORAGE_CONNECTION_STRING present');
    }
    if(process.env.TABLES_SAS){
      _lastAuthMode = 'sas';
      const fullUrl = `${accountUrl}/${tableName}${process.env.TABLES_SAS.startsWith('?')?process.env.TABLES_SAS:'?'+process.env.TABLES_SAS}`;
      return TableClient.fromTableUrl(fullUrl);
    }
    // 3. Managed Identity / DefaultAzureCredential (preferred secure path)
    _lastAuthMode = process.env.MANAGED_IDENTITY_CLIENT_ID ? 'managed_identity' : 'default_credential_chain';
    const credential = getCredential();
    return new TableClient(`${accountUrl}/${tableName}`, credential);
  }

  try {
    const client = build();
    if(process.env.TABLES_VERBOSE_LOGGING){
      console.log(`[tableClient] Initialized table client for "${tableName}" using authMode=${_lastAuthMode}`);
    }
    return client;
  } catch (e){
    const msg = e && e.message || String(e);
    // Specific defensive recovery: table name became an object somehow in production
    if(/table with value "\[object Object\]" must be of type string/i.test(msg)){
      console.warn('[tableClient] Detected object table name issue. Forcing fallback table name Subscribers. Raw env value =', process.env.SUBSCRIBERS_TABLE);
      tableName = 'Subscribers';
      try {
        const client = build();
        if(process.env.TABLES_VERBOSE_LOGGING){
          console.log(`[tableClient] Fallback client created for "${tableName}" using authMode=${_lastAuthMode}`);
        }
        return client;
      } catch (inner){ throw inner; }
    }
    throw e;
  }
}

function getLastAuthMode(){ return _lastAuthMode; }

module.exports = { getTableClient, getLastAuthMode };