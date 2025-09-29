const { ManagedIdentityCredential, DefaultAzureCredential } = require('@azure/identity');
const crypto = require('crypto');

module.exports = async function(context, req){
  const out = { timeUtc: new Date().toISOString() };
  try {
    const clientId = process.env.MANAGED_IDENTITY_CLIENT_ID; // user-assigned (not set for system-assigned normally)
    const cred = clientId ? new ManagedIdentityCredential(clientId) : new DefaultAzureCredential();
    // Table/Data endpoint requires https://storage.azure.com/.default scope
    const token = await cred.getToken('https://storage.azure.com/.default');
    out.token = { acquired: true, expiresOnTimestamp: token.expiresOnTimestamp };
  } catch(e){
    out.token = { acquired:false, error:e.message, stack:(e.stack||'').split('\n').slice(0,4) };
    context.res = { status:200, body: out }; return;
  }
  // Optionally attempt a raw list tables call if STORAGE_ACCOUNT_TABLE_URL set
  const acc = process.env.STORAGE_ACCOUNT_TABLE_URL;
  if(acc){
    try {
      const url = acc.replace(/\/$/,'') + '?comp=list';
      const resp = await fetch(url,{ headers:{ Authorization:'Bearer '+out.token.raw, Accept:'application/json;odata=nometadata' }});
      out.listAttempt = { status: resp.status };
      try { out.listJson = await resp.text(); } catch{}
    } catch(e){ out.listAttempt = { error: e.message }; }
  }
  context.res = { status:200, body: out };
};
