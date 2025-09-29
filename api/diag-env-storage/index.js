const { getLastAuthMode } = require('../shared/tableClient');

function mask(val){
  if(!val) return null;
  if(typeof val !== 'string') val = String(val);
  if(val.length <= 10) return val;
  return `${val.slice(0,6)}...${val.slice(-4)}`;
}

module.exports = async function (context, req){
  try {
    const env = process.env;
    const storageKeys = [
      'STORAGE_ACCOUNT_TABLE_URL','STORAGE_ACCOUNT_BLOB_URL','STORAGE_CONNECTION_STRING','TABLES_SAS','TABLES_SAS_B64',
      'SUBSCRIBERS_TABLE','RSVPS_TABLE','EVENTS_TABLE','MANAGED_IDENTITY_CLIENT_ID'
    ];
    const identityIndicators = [
      'MSI_ENDPOINT','MSI_SECRET','IDENTITY_ENDPOINT','IDENTITY_HEADER','IDENTITY_SERVER_THUMBPRINT'
    ];
    const storageConfig = {};
    storageKeys.forEach(k=>{ storageConfig[k] = env[k] ? (/(CONNECTION_STRING|SAS)/.test(k)?mask(env[k]):env[k]) : null; });
    if(env.TABLES_SAS){
      storageConfig.TABLES_SAS_LENGTH = env.TABLES_SAS.length;
    }
    if(env.TABLES_SAS_B64){
      storageConfig.TABLES_SAS_B64_LENGTH = env.TABLES_SAS_B64.length;
    }
    const identityVars = {};
    identityIndicators.forEach(k=>{ identityVars[k] = env[k] ? 'present' : null; });

    const response = {
      ok: true,
      timestamp: new Date().toISOString(),
      authModeLast: getLastAuthMode() || null,
      storageConfig,
      identity: {
        presenceSummary: identityIndicators.filter(k=>env[k]).length + '/' + identityIndicators.length,
        vars: identityVars
      },
      notes: [
        'Values containing secrets are masked.',
        'If no identity vars are present, ManagedIdentityCredential will report unavailable.',
        'Set TABLES_SAS (or TABLES_SAS_B64) or STORAGE_CONNECTION_STRING for temporary fallback if MI not yet active.',
        'TABLES_SAS_LENGTH helps confirm token is not truncated (typical length > 80 chars).'
      ]
    };
    context.res = { status: 200, jsonBody: response };
  } catch(err){
    context.res = { status: 500, jsonBody: { ok:false, error: err.message, stack: err.stack } };
  }
};
