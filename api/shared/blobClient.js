// Helper to get Azure Blob clients using managed identity
const { DefaultAzureCredential, ManagedIdentityCredential } = require('@azure/identity');
const { BlobServiceClient } = require('@azure/storage-blob');

function getCredential() {
  // Prefer managed identity in Azure; locally DefaultAzureCredential works
  const clientId = process.env.MANAGED_IDENTITY_CLIENT_ID;
  if (clientId) {
    return new ManagedIdentityCredential(clientId);
  }
  return new DefaultAzureCredential();
}

function getBlobServiceClient() {
  // Preferred: managed identity + account URL
  const conn = process.env.STORAGE_CONNECTION_STRING;
  if (conn) {
    return BlobServiceClient.fromConnectionString(conn);
  }
  const accountUrl = process.env.STORAGE_ACCOUNT_BLOB_URL; // e.g., https://<account>.blob.core.windows.net
  if (!accountUrl) throw new Error('Missing STORAGE_ACCOUNT_BLOB_URL or STORAGE_CONNECTION_STRING');
  const cred = getCredential();
  return new BlobServiceClient(accountUrl, cred);
}

function getBlobClient() {
  // Support both legacy PRAYER_TIMES_* and new STORAGE_* env variable names
  const container = process.env.STORAGE_CONTAINER || process.env.PRAYER_TIMES_CONTAINER || 'content';
  const blob = process.env.STORAGE_BLOB || process.env.PRAYER_TIMES_BLOB || 'prayer-times.json';
  const svc = getBlobServiceClient();
  const containerClient = svc.getContainerClient(container);
  return containerClient.getBlobClient(blob);
}

module.exports = { getBlobClient };
