const { getStorageRefs } = require('../shared/blobClient');

async function readBlobJson(blobClient) {
  const exists = await blobClient.exists();
  if (!exists) return null;
  const dl = await blobClient.download();
  const buf = await streamToBuffer(dl.readableStreamBody);
  return JSON.parse(buf.toString('utf8'));
}

async function writeBlobJson(blobClient, obj) {
  const data = Buffer.from(JSON.stringify(obj, null, 2), 'utf8');
  await blobClient.uploadData(data, { blobHTTPHeaders: { blobContentType: 'application/json' } });
}

function isAdmin(req) {
  // Static Web Apps injects X-MS-CLIENT-PRINCIPAL header when authenticated
  try {
    const principalB64 = req.headers['x-ms-client-principal'];
    if (!principalB64) return false;
    const json = Buffer.from(principalB64, 'base64').toString('utf8');
    const principal = JSON.parse(json);
    const roles = principal.userRoles || [];
    return roles.includes('admin');
  } catch {
    return false;
  }
}

async function streamToBuffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on('data', (d) => chunks.push(Buffer.from(d)));
    readable.on('end', () => resolve(Buffer.concat(chunks)));
    readable.on('error', reject);
  });
}

module.exports = async function (context, req) {
  const method = (req.method || 'GET').toUpperCase();
  // Attempt to initialize blob client; allow fallback if storage not configured
  let storage = null;
  try {
    storage = getStorageRefs();
  } catch (e) {
    context.log('Blob client initialization failed (will use local fallback if possible):', e.message);
  }

  if (method === 'GET') {
    try {
      let json = null;
    if (storage && storage.blobClient) {
        try {
      json = await readBlobJson(storage.blobClient);
        } catch (inner) {
          context.log('Blob read error, will attempt local fallback:', inner.message);
        }
      }
      if (!json) {
        // Fall back to local file (integrated functions deployment) if present
        const fallbackPaths = [
          '../../prayer-times.json',
          '../prayer-times.json',
          './prayer-times.json'
        ];
        for (const p of fallbackPaths) {
          try {
            const fallback = require(p);
    // Promote current month override if root adhan largely empty
    promoteCurrentMonthIntoRoot(fallback, context);
            return (context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: fallback });
          } catch {}
        }
  context.log('No blob + no local fallback prayer-times.json found');
  return (context.res = { status: 404, body: 'prayer-times.json not found' });
      }
  // Normalize: if root missing times but current month override has them, promote for easier client rendering
  promoteCurrentMonthIntoRoot(json, context);
      context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: json };
    } catch (err) {
      context.log('GET error', err.message);
      context.res = { status: 500, body: 'Failed to read prayer times' };
    }
    return;
  }

  if (method === 'POST') {
    // Enforce admin at API layer as well
    if (!isAdmin(req)) {
      // In SWA, 401/403 triggers auth; we return 401 to allow redirect from config
      context.res = { status: 401, body: 'Unauthorized' };
      return;
    }
    if (!storage || !storage.blobClient) {
      context.res = { status: 503, body: 'Storage not configured on server' };
      return;
    }
    try {
      const body = req.body;
      if (!body || typeof body !== 'object') {
        context.res = { status: 400, body: 'Invalid JSON' };
        return;
      }
      // Basic validation to avoid wiping existing schedule with empty object
      const hasContent = !!(body.months && Object.keys(body.months).length) || !!(body.days && Object.keys(body.days).length);
      if (!hasContent) {
        context.res = { status: 400, body: 'Refusing to save empty schedule (no months or days provided).' };
        return;
      }
  // If root adhan/iqamah mostly empty but exactly one month override exists, promote it into root for simplified client consumption
  promoteSingleMonthIntoRoot(body, context);
      // Ensure container exists
      try { await storage.containerClient.createIfNotExists({ access: 'private' }); } catch {}
  await writeBlobJson(storage.blobClient, body);
      context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: { status: 'OK', container: storage.containerName, blob: storage.blobName, months: Object.keys(body.months||{}).length, days: Object.keys(body.days||{}).length } };
    } catch (err) {
      context.log('POST error', err.message);
      context.res = { status: 500, body: 'Failed to save prayer times' };
    }
    return;
  }

  context.res = { status: 405, body: 'Method Not Allowed' };
};

// Helper: determine if root adhan/iqamah mostly empty (no keys with truthy values)
function isRootMostlyEmpty(obj){
  const a = (obj.adhan)||{}; const i = (obj.iqamah)||{};
  const hasAdhan = Object.values(a).some(v=> !!v);
  const hasIqamah = Object.values(i).some(v=> !!v);
  return !(hasAdhan || hasIqamah);
}

function promoteSingleMonthIntoRoot(body, context){
  try {
    if(!body || !body.months || typeof body.months !== 'object') return;
    const monthKeys = Object.keys(body.months);
    if(monthKeys.length !== 1) return; // only promote when exactly one month to avoid ambiguity
    if(!isRootMostlyEmpty(body)) return;
    const mk = monthKeys[0];
    const ov = body.months[mk];
    if(!ov) return;
    // Copy over fields if present
    for(const k of ['sunrise','note']) if(ov[k] && !body[k]) body[k] = ov[k];
    if(ov.adhan) body.adhan = { ...(ov.adhan) };
    if(ov.iqamah) body.iqamah = { ...(ov.iqamah) };
    if(Array.isArray(ov.jumuah)) body.jumuah = JSON.parse(JSON.stringify(ov.jumuah));
    context.log(`Promoted single month override (${mk}) into root for simpler consumption.`);
  } catch(e){ context.log('promoteSingleMonthIntoRoot error', e.message); }
}

function promoteCurrentMonthIntoRoot(json, context){
  try {
    if(!json || !json.months || typeof json.months !== 'object') return;
    if(!isRootMostlyEmpty(json)) return; // root already populated
    const now = new Date();
    const mk = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const ov = json.months[mk];
    if(!ov) return;
    for(const k of ['sunrise','note']) if(ov[k] && !json[k]) json[k] = ov[k];
    if(ov.adhan) json.adhan = { ...(ov.adhan) };
    if(ov.iqamah) json.iqamah = { ...(ov.iqamah) };
    if(Array.isArray(ov.jumuah) && (!json.jumuah || json.jumuah.length===0)) json.jumuah = JSON.parse(JSON.stringify(ov.jumuah));
    context.log(`Promoted current month override (${mk}) into root for GET response.`);
  } catch(e){ context.log('promoteCurrentMonthIntoRoot error', e.message); }
}
