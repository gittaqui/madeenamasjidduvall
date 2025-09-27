const { DefaultAzureCredential, ManagedIdentityCredential } = require('@azure/identity');
const { TableClient } = require('@azure/data-tables');
function credential(){ const id = process.env.MANAGED_IDENTITY_CLIENT_ID; return id? new ManagedIdentityCredential(id): new DefaultAzureCredential(); }
function build(name){
  if(process.env.STORAGE_CONNECTION_STRING) return TableClient.fromConnectionString(process.env.STORAGE_CONNECTION_STRING, name);
  const base = process.env.STORAGE_ACCOUNT_TABLE_URL || process.env.STORAGE_ACCOUNT_BLOB_URL?.replace(/blob\./,'table.') || process.env.TABLES_ACCOUNT_URL;
  if(!base) throw new Error('Missing storage account URL');
  if(process.env.TABLES_SAS){ const sas = process.env.TABLES_SAS.startsWith('?')?process.env.TABLES_SAS:'?'+process.env.TABLES_SAS; return TableClient.fromTableUrl(`${base}/${name}${sas}`); }
  return new TableClient(`${base}/${name}`, credential());
}
module.exports = { getSubscribersTable: ()=> build(process.env.SUBSCRIBERS_TABLE||'Subscribers'), getRsvpsTable: ()=> build(process.env.RSVP_TABLE_NAME||'Rsvps') };
