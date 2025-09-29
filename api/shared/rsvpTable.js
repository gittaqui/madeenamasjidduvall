const { TableClient } = require('@azure/data-tables');
const { getSpecificTableClient } = require('./tableClient');

function getRsvpTable(){
  const tableName = process.env.RSVP_TABLE_NAME || 'Rsvps';
  // Direct path if connection string is provided
  if(process.env.STORAGE_CONNECTION_STRING){
    return TableClient.fromConnectionString(process.env.STORAGE_CONNECTION_STRING, tableName);
  }
  // Use shared credential construction without mutating environment
  return getSpecificTableClient(tableName);
}

module.exports = { getRsvpTable };
