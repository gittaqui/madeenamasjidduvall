// This function has been archived. See _archive/prayer-times/ for the original code and data.
module.exports = async function(context, req) {
  context.res = { status: 410, body: { error: 'This endpoint is archived. No longer available.' } };
};
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
    if(process.env.DEV_ALLOW_NON_ADMIN === '1'){
      context.log('DEV_ALLOW_NON_ADMIN=1 active: bypassing auth/role checks for POST');
    } else {
      // Auth & role evaluation
      const { isAuthenticated, isAdmin, roles } = authStatus(req);
      if(!isAuthenticated){
        context.res = { status: 401, body: 'Unauthorized (not signed in)' }; // triggers login redirect
        return;
      }
      if(!isAdmin){
        // Return 403 so user sees forbidden instead of login loop when already signed in
        context.res = { status: 403, body: 'Forbidden: admin role required. Roles on token: '+ roles.join(', ') };
        return;
      }
    }
  const fs = require('fs');
  const path = require('path');
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
      let persistedVia = 'blob';
      if (storage && storage.blobClient) {
        try {
          try { await storage.containerClient.createIfNotExists({ access: 'private' }); } catch {}
          await writeBlobJson(storage.blobClient, body, context);
        } catch (blobErr) {
          context.log('Blob upload failed, attempting local file fallback:', blobErr.message);
          persistedVia = 'local-file';
        }
      } else {
        persistedVia = 'local-file';
      }
      if (persistedVia === 'local-file') {
        const localPath = path.join(__dirname, '..', '..', 'prayer-times.local.json');
        try {
          fs.writeFileSync(localPath, JSON.stringify(body, null, 2), 'utf8');
          context.log('Saved prayer times to local fallback file', localPath);
        } catch(fileErr){
          context.log('Local file fallback write failed:', fileErr.message);
          throw new Error('Both blob storage and local file fallback failed: '+ fileErr.message);
        }
      }
      context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: { status: 'OK', via: persistedVia, container: storage && storage.containerName, blob: storage && storage.blobName, months: Object.keys(body.months||{}).length, days: Object.keys(body.days||{}).length } };
    } catch (err) {
      context.log('POST error', err.message);
      context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: 'Failed to save prayer times', message: err.message, stack: err.stack } };
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
