const { TableClient } = require('@azure/data-tables');
const { getTableClient } = require('./tableClient');

function getRsvpTable(){
  // Reuse existing connection method but allow separate table name
  if(process.env.RSVP_TABLE_NAME){
    if(process.env.STORAGE_CONNECTION_STRING){
      return TableClient.fromConnectionString(process.env.STORAGE_CONNECTION_STRING, process.env.RSVP_TABLE_NAME);
    }
  }
  // fallback: temporarily override env for shared client
  const original = process.env.SUBSCRIBERS_TABLE;
  process.env.SUBSCRIBERS_TABLE = process.env.RSVP_TABLE_NAME || 'Rsvps';
  try { return getTableClient(); } finally { process.env.SUBSCRIBERS_TABLE = original; }
}

module.exports = { getRsvpTable };
