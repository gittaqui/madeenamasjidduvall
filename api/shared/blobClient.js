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
  const accountUrl = process.env.STORAGE_ACCOUNT_BLOB_URL; // e.g., https://<account>.blob.core.windows.net
  if (!accountUrl) throw new Error('Missing STORAGE_ACCOUNT_BLOB_URL');
  const cred = getCredential();
  return new BlobServiceClient(accountUrl, cred);
}

function getBlobClient() {
  const container = process.env.PRAYER_TIMES_CONTAINER || 'config';
  const blob = process.env.PRAYER_TIMES_BLOB || 'prayer-times.json';
  const svc = getBlobServiceClient();
  const containerClient = svc.getContainerClient(container);
  return containerClient.getBlobClient(blob);
}

module.exports = { getBlobClient };
