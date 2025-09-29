const { TableClient } = require('@azure/data-tables');
const { getTableClient } = require('./tableClient');

function getEventsTable(){
  // Allow override via EVENTS_TABLE_NAME else default 'Events'
  const name = process.env.EVENTS_TABLE_NAME || 'Events';
  // Reuse generic client creation without mutating SUBSCRIBERS_TABLE env
  if(process.env.STORAGE_CONNECTION_STRING){
    return TableClient.fromConnectionString(process.env.STORAGE_CONNECTION_STRING, name);
  }
  // Derive account URL similar to tableClient logic
  const accountUrl = process.env.STORAGE_ACCOUNT_TABLE_URL
    || process.env.STORAGE_ACCOUNT_BLOB_URL?.replace(/blob\./,'table.')
    || process.env.TABLES_ACCOUNT_URL;
  if(accountUrl){
    // Use same credentials path as subscribers table by temporarily creating through getTableClient with env change
    const orig = process.env.SUBSCRIBERS_TABLE;
    process.env.SUBSCRIBERS_TABLE = name;
    try { return getTableClient(); } finally { process.env.SUBSCRIBERS_TABLE = orig; }
  }
  throw new Error('Missing storage account configuration for Events table');
}

module.exports = { getEventsTable };
