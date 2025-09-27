const crypto = require('crypto');
const { getRsvpTable } = require('../shared/rsvpTable');
const { validateEventId, loadEvents } = require('../shared/rsvpEvents');

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/i;
function normalizeEmail(e){ return (e||'').trim().toLowerCase(); }
function randomToken(){ return crypto.randomBytes(20).toString('hex'); }

module.exports = async function(context, req){
  if((req.headers['content-type']||'').includes('multipart')) return context.res = { status:400, body:{ error:'multipart_not_supported' } };
  const body = req.body || {};
  const eventId = (body.eventId||'').trim();
  const email = normalizeEmail(body.email);
  const name = (body.name||'').trim().slice(0,80);
  const adults = Number.isFinite(body.adults)? Math.max(0, Math.min(20, body.adults|0)) : 1;
  const children = Number.isFinite(body.children)? Math.max(0, Math.min(50, body.children|0)) : 0;
  const notes = (body.notes||'').trim().slice(0,300);
  const honeypot = (body.website||'').trim();
  if(honeypot) return context.res = { status:200, body:{ ok:true } }; // silent
  if(!EMAIL_REGEX.test(email)) return context.res = { status:400, body:{ error:'invalid_email' } };
  if(!validateEventId(eventId)) return context.res = { status:400, body:{ error:'invalid_event' } };

  // Ensure event exists and is upcoming
  const events = await loadEvents(req);
  const ev = events.find(e=> e.id === eventId && e.published !== false);
  if(!ev) return context.res = { status:404, body:{ error:'event_not_found' } };
  try { const d = new Date(ev.date+'T00:00:00'); if(isNaN(d) || d < new Date(Date.now()-86400000)) return context.res = { status:400, body:{ error:'event_closed' } }; } catch {}

  const table = getRsvpTable();
  try { try { await table.createTable(); } catch {}
  const partitionKey = eventId; // event scoped
    const rowKey = email;
    let existing = null; try { existing = await table.getEntity(partitionKey, rowKey); } catch {}
    const now = new Date().toISOString();
    if(existing){
      // If already confirmed, return idempotent success
      if(existing.status === 'confirmed'){
        return context.res = { status:200, body:{ ok:true, status:'confirmed', already:true } };
      }
      existing.name = name || existing.name;
      existing.adults = adults;
      existing.children = children;
      existing.notes = notes;
      existing.updatedUtc = now;
      await table.updateEntity(existing, "Merge");
      return context.res = { status:200, body:{ ok:true, status: existing.status || 'pending', already:true } };
    }
    // Capacity & waitlist
    const capacityEnv = process.env[`RSVP_CAPACITY_${eventId.toUpperCase().replace(/[^A-Z0-9]/g,'_')}`];
    const capacity = capacityEnv ? Number(capacityEnv) : null;
    let confirmedCount = 0;
    if(capacity){
      for await(const ent of table.listEntities({ queryOptions:{ filter:`PartitionKey eq '${eventId}'`}})){
        if(ent.status === 'confirmed') confirmedCount += (ent.adults||0) + (ent.children||0) || 1;
      }
    }
    const token = randomToken();
    const requireConfirm = (process.env.RSVP_REQUIRE_CONFIRM || 'false').toLowerCase() === 'true';
    let status = requireConfirm ? 'pending' : 'confirmed';
    let waitlisted = false;
    if(capacity){
      const requestedSeats = (adults||0) + (children||0) || 1;
      if(confirmedCount + requestedSeats > capacity){
        status = 'waitlist';
        waitlisted = true;
      }
    }
  // Do NOT store the token on the main RSVP entity for privacy / leakage minimization.
  // Only the token index row (partition 'token') retains the mapping for confirm/cancel.
  const entity = { partitionKey, rowKey, email, name, adults, children, notes, status, createdUtc: now, updatedUtc: now };
    await table.upsertEntity(entity);
    // token index row for O(1) confirm/cancel lookups
    await table.upsertEntity({ partitionKey:'token', rowKey:token, eventId, email, createdUtc: now });
    if(requireConfirm && status === 'pending'){
      context.log('[rsvp] confirmation token', token);
      // fire-and-forget email send if configured
      try {
        const site = process.env.SITE_ORIGIN || (req.headers['x-forwarded-host'] ? `https://${req.headers['x-forwarded-host']}` : '');
        const confirmUrl = site ? `${site}/rsvp-confirm.html?token=${token}` : `/rsvp-confirm.html?token=${token}`;
        const cancelUrl = site ? `${site}/rsvp-cancel.html?token=${token}` : `/rsvp-cancel.html?token=${token}`;
        context.log('[rsvp] email links', confirmUrl, cancelUrl);
        await fetch(process.env.RSVP_EMAIL_API || 'api/send-email', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({
            name: name || email,
            email: process.env.RSVP_NOTIFY_TO || process.env.TO_EMAIL || email,
            subject: `RSVP Pending: ${ev.title}`,
            message: `Confirm your RSVP for ${ev.title} on ${ev.date}.\n\nConfirm: ${confirmUrl}\nCancel: ${cancelUrl}\n\nIf you did not request this, ignore.`
          })
        }).catch(err=> context.log('[rsvp] send-email error', err.message));
      } catch(mailErr){ context.log('[rsvp] mail dispatch failed', mailErr.message); }
    }
    context.res = { status:200, body:{ ok:true, status, needConfirm: requireConfirm, waitlisted } };
  } catch (e){
    const msg = e.message || String(e);
    context.log('[rsvp] error', msg);
    if(/ECONNREFUSED|ENOTFOUND|EAI_AGAIN/i.test(msg)) return context.res = { status:503, body:{ error:'table_unreachable' } };
    context.res = { status:500, body:{ error:'rsvp_failed', detail: msg } };
  }
};
