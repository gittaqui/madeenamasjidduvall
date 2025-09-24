// Helper to get Azure Blob clients using managed identity
const { DefaultAzureCredential, ManagedIdentityCredential } = require('@azure/identity');
const { BlobServiceClient } = require('@azure/storage-blob');

function getCredential() {
  const clientId = process.env.MANAGED_IDENTITY_CLIENT_ID;
  if (clientId) return new ManagedIdentityCredential(clientId);
  return new DefaultAzureCredential();
}

function getBlobServiceClient() {
  const conn = process.env.STORAGE_CONNECTION_STRING;
  if (conn) return BlobServiceClient.fromConnectionString(conn);
  const accountUrl = process.env.STORAGE_ACCOUNT_BLOB_URL;
  if (!accountUrl) throw new Error('Missing STORAGE_ACCOUNT_BLOB_URL or STORAGE_CONNECTION_STRING');
  return new BlobServiceClient(accountUrl, getCredential());
}

function getStorageRefs() {
  const containerName = process.env.STORAGE_CONTAINER || process.env.PRAYER_TIMES_CONTAINER || 'content';
  const blobName = process.env.STORAGE_BLOB || process.env.PRAYER_TIMES_BLOB || 'prayer-times.json';
  const serviceClient = getBlobServiceClient();
  const containerClient = serviceClient.getContainerClient(containerName);
  // Use BlockBlobClient explicitly so we have predictable upload APIs
  const blobClient = containerClient.getBlockBlobClient(blobName);
  return { serviceClient, containerClient, blobClient, containerName, blobName };
}

module.exports = { getStorageRefs };
