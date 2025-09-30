const { getLastAuthMode, getTableClient } = require('../shared/tableClient');

module.exports = async function(context, req){
  const now = new Date();
  const isoNow = now.toISOString();
  const targetDateStr = process.env.GUARD_TARGET_DATE || null; // e.g. 2025-10-15
  const targetDate = targetDateStr ? new Date(targetDateStr) : null;
  const graceDays = parseInt(process.env.GUARD_GRACE_DAYS || '0', 10);
  const afterTarget = targetDate ? (now.getTime() > targetDate.getTime() + graceDays*86400000) : false;

  const lastAuthMode = getLastAuthMode();
  const env = process.env;
  const secretFallbackPresent = !!(env.STORAGE_CONNECTION_STRING || env.STORAGE_CONNECTION_STRING_B64 || env.TABLES_SAS || env.TABLES_SAS_B64);
  const warnings = [];
  const info = [];

  // Quick probe (best-effort) to ensure tables still accessible.
  let probe = null;
  try {
    const client = getTableClient();
    const it = client.listEntities({ queryOptions:{ top:1 }});
    await it.next();
    probe = { ok:true };
  } catch(e){
    probe = { ok:false, error: e.message, code: e.statusCode || e.code };
    warnings.push('Table probe failed; storage access may be broken');
  }

  if(secretFallbackPresent && lastAuthMode === 'managed_identity'){
    warnings.push('Secret-based fallback variables still present even though managed identity is active. Remove them to reduce risk.');
  }
  if(secretFallbackPresent && lastAuthMode !== 'managed_identity'){
    info.push('Running with secret-based auth (expected until MI works).');
    if(afterTarget){
      warnings.push('Past guard target date and still using secret-based auth. Plan migration to Managed Identity.');
    }
  }
  if(!secretFallbackPresent && lastAuthMode !== 'managed_identity'){
    warnings.push('No secret fallback present but managed identity not active; storage calls may fail.');
  }
  if(!targetDateStr){
    info.push('Set GUARD_TARGET_DATE (YYYY-MM-DD) to enforce a cutoff for secrets.');
  }

  const response = {
    timeUtc: isoNow,
    lastAuthMode,
    secretFallbackPresent,
    connectionStringSetAt: env.STORAGE_CONNECTION_STRING_SET_AT || null,
    targetDate: targetDateStr,
    afterTarget,
    probe,
    warnings,
    info,
    envFlags: {
      STORAGE_CONNECTION_STRING: !!env.STORAGE_CONNECTION_STRING,
      STORAGE_CONNECTION_STRING_B64: !!env.STORAGE_CONNECTION_STRING_B64,
      TABLES_SAS: !!env.TABLES_SAS,
      TABLES_SAS_B64: !!env.TABLES_SAS_B64,
      MANAGED_IDENTITY_CLIENT_ID: !!env.MANAGED_IDENTITY_CLIENT_ID
    }
  };

  const status = warnings.length ? 200 : 200; // always 200; clients decide severity
  context.res = { status, jsonBody: response };
};
