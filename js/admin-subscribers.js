(function(){
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
      const res = await fetch(`/api/subscribers?status=${encodeURIComponent(status)}`);
      if(!res.ok) throw new Error(res.status+' error');
      const data = await res.json();
      if(!data.ok) throw new Error('API error');
      info.textContent = `${data.count} ${status} subscriber(s)`;
      for(const row of data.items){
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${row.email||''}</td><td>${status}</td><td>${fmt(row.createdUtc)}</td><td>${fmt(row.confirmedUtc)}</td><td>${fmt(row.unsubUtc)}</td><td><button class="btn btn-sm btn-outline-danger" data-hash="${row.hash}">Delete</button></td>`;
        tbody.appendChild(tr);
      }
    } catch(err){
      console.error(err); info.textContent = 'Load failed: '+err.message;
    }
  }

  async function del(hash){
    if(!confirm('Delete this subscriber?')) return;
    const status = currentStatus();
    try {
      const res = await fetch(`/api/subscribers?status=${encodeURIComponent(status)}&hash=${encodeURIComponent(hash)}`, { method:'DELETE' });
      if(!res.ok) throw new Error('Delete failed');
      await load();
    } catch(err){ alert(err.message); }
  }

  tbody.addEventListener('click', e=>{
    if(e.target.matches('button[data-hash]')){
      del(e.target.getAttribute('data-hash'));
    }
  });
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
    try { await fetch('/api/cleanup-pending'); alert('Requested. Check logs.'); } catch(e){ alert('Failed'); }
  });

  load();
})();