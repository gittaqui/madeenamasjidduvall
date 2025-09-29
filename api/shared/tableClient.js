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

// Core builder that accepts an explicit table name (preferred internally)
function getSpecificTableClient(explicitName){
  let tableName = explicitName || process.env.SUBSCRIBERS_TABLE || 'Subscribers';
  // Hard guard: if somehow an object sneaks in, serialize keys for visibility
  if(tableName && typeof tableName === 'object'){
    try {
      const summary = Array.isArray(tableName) ? '[array]' : '{'+Object.keys(tableName).join(',')+'}';
      console.warn('[tableClient] Received non-string tableName object, keys:', summary);
    } catch{}
  }
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
  // Correct constructor usage: first param is account (table service) URL, second is table name, third the credential
  // Previous (incorrect) code appended the table name to the URL and passed credential as the tableName arg, causing
  // Azure core serializer to see an object for the "table" path parameter -> "[object Object]" error.
  return new TableClient(accountUrl.replace(/\/$/, ''), tableName, credential);
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

// Backwards compatible wrapper (legacy callers)
function getTableClient(){
  return getSpecificTableClient();
}

function getLastAuthMode(){ return _lastAuthMode; }

module.exports = { getTableClient, getSpecificTableClient, getLastAuthMode };