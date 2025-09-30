// Admin RSVP management UI
// Fetches /api/rsvps (admin only) and renders table with filters + CSV export link
(function(){
  // Admin listing endpoints (rsvps) remain on the Static Web App internal Functions API.
  // Do NOT use external RSVP_API_BASE here or you'll hit 404 (external app does not expose /rsvps listing).
  const API_BASE = '/api';
  const eventSel = document.getElementById('eventFilter');
  const statusSel = document.getElementById('statusFilter');
  const limitInput = document.getElementById('limitInput');
  const refreshBtn = document.getElementById('refreshBtn');
  const csvBtn = document.getElementById('csvBtn');
  const deleteAllEventBtn = document.getElementById('deleteAllEventBtn');
  const tbody = document.querySelector('#rsvpTable tbody');
  const summaryBox = document.getElementById('summaryBox');
  const notesBox = document.getElementById('notesBox');
  let allItems = [];
  function fmtDate(dt){
    if(!dt) return '';
    // Expecting ISO or epoch
    if(/^[0-9]+$/.test(dt)) return new Date(Number(dt)).toLocaleString();
    return new Date(dt).toLocaleString();
  }
  function badge(status){
    if(!status) return '';
    const map = { pending:'secondary', confirmed:'success', canceled:'danger', waitlist:'warning' };
    const cls = map[status]||'secondary';
    return `<span class="badge bg-${cls} status-badge">${status}</span>`;
  }
  function applyFilters(){
    const st = (statusSel.value||'').toLowerCase();
    const ev = eventSel.value||'';
    const filtered = allItems.filter(i=> (!st || (i.status||'').toLowerCase()===st) && (!ev || i.eventId===ev));
    renderRows(filtered);
  }
  function renderRows(rows){
    tbody.innerHTML = rows.map(r=>`<tr data-event="${encodeURIComponent(r.eventId)}" data-email="${encodeURIComponent(r.email)}">
      <td class="text-nowrap">${escapeHtml(r.eventId)}</td>
      <td>${escapeHtml(r.name||'')}</td>
      <td class="mono">${escapeHtml(r.email)}</td>
      <td class="text-end">${r.adults||0}</td>
      <td class="text-end">${r.children||0}</td>
      <td>${badge(r.status)}</td>
      <td class="text-nowrap small">${fmtDate(r.createdUtc)}</td>
      <td class="text-nowrap small">${fmtDate(r.confirmedUtc)}</td>
      <td class="text-nowrap small">${fmtDate(r.canceledUtc)}</td>
      <td class="text-center"><button class="btn btn-sm btn-outline-danger btn-del" aria-label="Delete RSVP" title="Delete RSVP">✕</button></td>
    </tr>`).join('');
    const totalAdults = rows.reduce((a,b)=> a + (Number(b.adults)||0),0);
    const totalChildren = rows.reduce((a,b)=> a + (Number(b.children)||0),0);
    summaryBox.textContent = `${rows.length} row(s) | Adults ${totalAdults} | Children ${totalChildren}`;
    wireRowDeleteHandlers();
  }
  function escapeHtml(s){ return (s||'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]||c)); }
  async function load(){
    const ev = eventSel.value||'';
    const limit = limitInput.value||1000;
  const url = `${API_BASE}/rsvps?limit=${encodeURIComponent(limit)}${ev?`&eventId=${encodeURIComponent(ev)}`:''}&_ts=${Date.now()}`;
    summaryBox.textContent = 'Loading…';
    try{
  const resp = await fetch(url,{credentials:'include', cache:'no-store'});
      if(resp.status === 401){
        tbody.innerHTML = '<tr><td colspan="9" class="text-danger">Unauthorized (401) – Your signed-in account lacks the admin role. Assign role "admin" in Static Web App Roles settings and re-login.</td></tr>';
        summaryBox.textContent = '';
        notesBox.textContent = 'Tip: After assigning a new role, you may need to sign out and sign back in for the new role to appear.';
        return;
      }
      if(resp.status === 404){
        tbody.innerHTML = '<tr><td colspan="9" class="text-danger">Endpoint not found (404). If this is a newly added function, ensure it was committed & deployed. Locally, restart the SWA CLI to pick up new functions.</td></tr>';
        summaryBox.textContent='';
        notesBox.textContent='Check api/rsvps/function.json exists and the folder name matches the route.';
        return;
      }
      if(!resp.ok) throw new Error('Request failed '+resp.status);
      const data = await resp.json();
      if(!data || !data.items){ throw new Error('Malformed response'); }
      allItems = data.items;
  if(!allItems.length){ console.info('[admin-rsvps] No RSVP rows returned. Verify SWA storage points to external data or that external app has stored rows yet.'); }
      buildEventOptions(data.events||[]);
      applyFilters();
      notesBox.textContent = `Showing up to ${limit} entries. Use CSV export for complete dataset.`;
      updateCsvLink();
    }catch(e){
      tbody.innerHTML = `<tr><td colspan="9" class="text-danger">Error: ${escapeHtml(e.message)}</td></tr>`;
      summaryBox.textContent = '';
    }
  }
  function buildEventOptions(events){
    if(eventSel.options.length <= 1){ // initial population only
      events.forEach(ev=>{
        const opt = document.createElement('option');
        opt.value = ev.id || ev.eventId || ev.slug || ev.title; // fallback heuristics
        const synth = ev.synthetic ? ' (synthetic)' : '';
        opt.textContent = `${ev.id || ev.eventId || ev.slug || '?'} – ${ev.title||ev.name||''}${synth}`;
        if(ev.synthetic){ opt.dataset.synthetic = 'true'; }
        eventSel.appendChild(opt);
      });
    }
    updateDeleteAllVisibility();
  }
  function updateCsvLink(){
    const ev = eventSel.value||'';
  const href = `${API_BASE}/rsvps?format=csv${ev?`&eventId=${encodeURIComponent(ev)}`:''}`;
    csvBtn.href = href;
  }
  function updateDeleteAllVisibility(){
    const ev = eventSel.value||'';
    if(ev){ deleteAllEventBtn.classList.remove('d-none'); deleteAllEventBtn.disabled = false; }
    else { deleteAllEventBtn.classList.add('d-none'); }
  }
  async function deleteOne(eventId,email,btn){
    if(!confirm(`Delete RSVP for ${email} on event ${eventId}? This cannot be undone.`)) return;
    btn.disabled = true; btn.textContent = '…';
    try {
      const url = `${API_BASE}/rsvps?eventId=${encodeURIComponent(eventId)}&email=${encodeURIComponent(email)}`;
      const resp = await fetch(url,{ method:'DELETE', credentials:'include'});
      if(!resp.ok){ throw new Error('Delete failed '+resp.status); }
      // remove from local array & re-render
      allItems = allItems.filter(i=> !(i.eventId===eventId && i.email===email));
      applyFilters();
    } catch(e){ alert('Error: '+e.message); btn.disabled=false; btn.textContent='✕'; }
  }
  function wireRowDeleteHandlers(){
    tbody.querySelectorAll('.btn-del').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const tr = btn.closest('tr');
        if(!tr) return;
        const eventId = decodeURIComponent(tr.getAttribute('data-event'));
        const email = decodeURIComponent(tr.getAttribute('data-email'));
        deleteOne(eventId,email,btn);
      });
    });
  }
  async function deleteAllForEvent(){
    const ev = eventSel.value||'';
    if(!ev) return;
    const rowsForEv = allItems.filter(i=> i.eventId===ev);
    if(!rowsForEv.length){ alert('No rows for that event.'); return; }
    if(!confirm(`Delete ALL ${rowsForEv.length} RSVP(s) for event ${ev}? This cannot be undone.`)) return;
    deleteAllEventBtn.disabled = true; deleteAllEventBtn.textContent = 'Deleting…';
    let success = 0, fail=0;
    for(const r of rowsForEv){
      try {
        const url = `${API_BASE}/rsvps?eventId=${encodeURIComponent(r.eventId)}&email=${encodeURIComponent(r.email)}`;
        const resp = await fetch(url,{ method:'DELETE', credentials:'include'});
        if(resp.ok){ success++; }
        else { fail++; }
      } catch { fail++; }
    }
    deleteAllEventBtn.disabled = false; deleteAllEventBtn.textContent = 'Delete All (Event)';
    // reload list to ensure consistency
    await load();
    alert(`Bulk delete complete. Success: ${success}, Failed: ${fail}`);
  }
  deleteAllEventBtn.addEventListener('click', deleteAllForEvent);
  refreshBtn.addEventListener('click', load);
  eventSel.addEventListener('change', ()=>{ applyFilters(); updateCsvLink(); updateDeleteAllVisibility(); });
  statusSel.addEventListener('change', applyFilters);
  limitInput.addEventListener('change', load);
  load();
})();
