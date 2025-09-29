(function(){
  // Admin subscribers management must always hit internal Functions API, not external base.
  const API_BASE = '/api';
  const statusSel = document.getElementById('filter-status');
  const tbody = document.querySelector('#subs-table tbody');
  const info = document.getElementById('status-info');
  const refreshBtn = document.getElementById('refresh-btn');
  const exportBtn = document.getElementById('export-btn');
  const purgeBtn = document.getElementById('purge-pending-btn');

  function fmt(dt){ if(!dt) return ''; return new Date(dt).toLocaleString(); }
  function currentStatus(){ return statusSel.value; }

  async function load(){
    info.textContent = 'Loading...';
    tbody.innerHTML='';
    const status = currentStatus();
    try {
  const res = await fetch(`${API_BASE}/subscribers?status=${encodeURIComponent(status)}`, { credentials:'include', cache:'no-store' });
      if(!res.ok) throw new Error(res.status+' error');
      const data = await res.json();
      if(!data.ok) throw new Error('API error');
      info.textContent = `${data.count} ${status} subscriber(s)`;
      for(const row of data.items){
        const tr = document.createElement('tr');
        const actions = [];
        if(status === 'pending') actions.push(`<button class="btn btn-sm btn-outline-success me-1" data-activate="${row.hash}">Activate</button>`);
        actions.push(`<button class="btn btn-sm btn-outline-danger" data-hash="${row.hash}">Delete</button>`);
        tr.innerHTML = `<td>${row.email||''}</td><td>${status}</td><td>${fmt(row.createdUtc)}</td><td>${fmt(row.confirmedUtc)}</td><td>${fmt(row.unsubUtc)}</td><td>${actions.join('')}</td>`;
        tbody.appendChild(tr);
      }
    } catch(err){
      console.error(err); info.textContent = 'Load failed: '+err.message;
    }
  }

  async function del(hash){
    if(!confirm('Delete this subscriber?')) return;
    // Use status=any to allow deletion after partition changes (e.g., pending -> active)
    try {
  const res = await fetch(`${API_BASE}/subscribers?status=any&hash=${encodeURIComponent(hash)}`, { method:'DELETE', headers:{'Accept':'application/json'}, credentials:'include' });
      if(!res.ok){ const t = await res.text(); throw new Error(`Delete failed (${res.status}) ${t}`); }
      await load();
    } catch(err){ alert(err.message); }
  }

  tbody.addEventListener('click', e=>{
    if(e.target.matches('button[data-hash]')){
      del(e.target.getAttribute('data-hash'));
    } else if(e.target.matches('button[data-activate]')){
      activate(e.target.getAttribute('data-activate'));
    }
  });

  async function activate(hash){
    if(!confirm('Activate this subscriber (treat as confirmed)?')) return;
    try {
  const res = await fetch(`${API_BASE}/subscribers?status=pending&action=activate&hash=${encodeURIComponent(hash)}`, { method:'POST', headers:{'Accept':'application/json'}, credentials:'include' });
      if(!res.ok){ const t = await res.text(); throw new Error(`Activate failed (${res.status}) ${t}`); }
      await load();
    } catch(err){ alert(err.message); }
  }
  refreshBtn.addEventListener('click', load);
  statusSel.addEventListener('change', load);

  exportBtn.addEventListener('click', ()=>{
    const rows = [...tbody.querySelectorAll('tr')].map(tr=>[...tr.children].slice(0,5).map(td=>`"${(td.textContent||'').replace(/"/g,'""')}"`).join(','));
    const header = 'Email,Status,Created,Confirmed,Unsub';
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type:'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `subscribers-${currentStatus()}.csv`; a.click();
  });

  // purge button triggers cleanup function by hitting it via admin (could create an explicit API if needed)
  purgeBtn.addEventListener('click', async ()=>{
    if(!confirm('Trigger cleanup job now? Old pending (24h+) removed.')) return;
  try { await fetch(`${API_BASE}/cleanup-pending`, { credentials:'include' }); alert('Requested. Check logs.'); } catch(e){ alert('Failed'); }
  });

  load();
})();