(function(){
  const MONTH_INPUT = document.getElementById('month');
  const RANGE_START = document.getElementById('range-start');
  const RANGE_END = document.getElementById('range-end');
  const fileInput = document.getElementById('file-input');
  const btnLoad = document.getElementById('btn-load-json');
  const btnFetchServer = document.getElementById('btn-fetch-server');
  const btnFillMonthFromDefaults = document.getElementById('btn-use-defaults');
  const btnApplyRange = document.getElementById('btn-apply-range');
  const btnDownload = document.getElementById('btn-download');
  const btnSaveServer = document.getElementById('btn-save-server');
  const btnReset = document.getElementById('btn-reset');
  const btnPrevMonth = document.getElementById('btn-range-prev-month');
  const btnThisMonth = document.getElementById('btn-range-this-month');
  const btnNextMonth = document.getElementById('btn-range-next-month');
  const presetMonthInput = document.getElementById('preset-month');
  const btnSetMonth = document.getElementById('btn-range-set-month');
  const authStatusEl = document.getElementById('auth-status');

  let data = {
    updated: new Date().toISOString().slice(0,10),
    note: '',
  sunrise: '', // auto-fetched
    adhan: {},
    iqamah: {},
    jumuah: [],
    months: {},
    days: {}
  };

  function byId(id){ return document.getElementById(id); }
  function assignFields(prefix){
    const obj = {
  sunrise: data.sunrise || '',
  note: byId(`${prefix}-note`).value.trim(),
      adhan: {
        fajr: byId(`${prefix}-adhan-fajr`).value.trim(),
        dhuhr: byId(`${prefix}-adhan-dhuhr`).value.trim(),
  asr: byId(`${prefix}-adhan-asr`).value.trim(),
        maghrib: byId(`${prefix}-adhan-maghrib`).value.trim(),
        isha: byId(`${prefix}-adhan-isha`).value.trim()
      },
      iqamah: {
        fajr: byId(`${prefix}-iqamah-fajr`).value.trim(),
        dhuhr: byId(`${prefix}-iqamah-dhuhr`).value.trim(),
  asr: byId(`${prefix}-iqamah-asr`).value.trim(),
        maghrib: byId(`${prefix}-iqamah-maghrib`).value.trim(),
        isha: byId(`${prefix}-iqamah-isha`).value.trim()
      },
      jumuah: collectJumuah(prefix)
    };
    return obj;
  }
  function collectJumuah(prefix){
    const map = { ov: 'ov-jumuah', rg: 'rg-jumuah' };
    const host = byId(map[prefix] || 'ov-jumuah');
    return Array.from(host.querySelectorAll('.j-row')).map(row => ({
      title: row.querySelector('.j-title').value.trim(),
      start: row.querySelector('.j-start').value.trim(),
      end: row.querySelector('.j-end').value.trim()
    })).filter(x => x.title || x.start || x.end);
  }
  function addJumuahRow(prefix, val={}){
    const host = byId(prefix === 'ov' ? 'ov-jumuah' : 'rg-jumuah');
    const div = document.createElement('div');
    div.className = 'j-row d-flex gap-2';
    div.innerHTML = `
      <input class="form-control j-title" placeholder="Title (e.g., 1st Jumu'ah)" title="Jumu'ah title" value="${val.title||''}">
      <input class="form-control j-start" placeholder="Start (e.g., 01:00 PM)" title="Start time" value="${val.start||''}">
      <input class="form-control j-end" placeholder="End (e.g., 01:45 PM)" title="End time" value="${val.end||''}">
      <button class="btn btn-outline-danger" type="button">Remove</button>
    `;
    div.querySelector('button').addEventListener('click', ()=> div.remove());
    host.appendChild(div);
  }
  function monthBounds(year, monthIdx){
    const start = new Date(Date.UTC(year, monthIdx, 1));
    const end = new Date(Date.UTC(year, monthIdx + 1, 0));
    const toLocalISO = (d)=> new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()).toISOString().slice(0,10);
    return { start: toLocalISO(start), end: toLocalISO(end) };
  }
  function setRangeTo(year, monthIdx){
    const { start, end } = monthBounds(year, monthIdx);
    if(RANGE_START) RANGE_START.value = start;
    if(RANGE_END) RANGE_END.value = end;
  }
  function fillMonthFromDefaults(){
    // Prefill the month override UI with root defaults
  byId('ov-note').value = data.note || '';
    byId('ov-adhan-fajr').value = (data.adhan||{}).fajr || '';
    byId('ov-adhan-dhuhr').value = (data.adhan||{}).dhuhr || '';
    byId('ov-adhan-asr').value = (data.adhan||{}).asr || '';
  // removed asrHanafi
    byId('ov-adhan-maghrib').value = (data.adhan||{}).maghrib || '';
    byId('ov-adhan-isha').value = (data.adhan||{}).isha || '';
    byId('ov-iqamah-fajr').value = (data.iqamah||{}).fajr || '';
    byId('ov-iqamah-dhuhr').value = (data.iqamah||{}).dhuhr || '';
    byId('ov-iqamah-asr').value = (data.iqamah||{}).asr || '';
  // removed asrHanafi
    byId('ov-iqamah-maghrib').value = (data.iqamah||{}).maghrib || '';
    byId('ov-iqamah-isha').value = (data.iqamah||{}).isha || '';
    const host = byId('ov-jumuah'); host.innerHTML='';
    (data.jumuah||[]).forEach(item=> addJumuahRow('ov', item));
  }
  function fillOverride(key){
    const ov = (data.months && data.months[key]) || {};
  byId('ov-note').value = ov.note || '';
    byId('ov-adhan-fajr').value = (ov.adhan||{}).fajr || '';
    byId('ov-adhan-dhuhr').value = (ov.adhan||{}).dhuhr || '';
    byId('ov-adhan-asr').value = (ov.adhan||{}).asr || '';
  // removed asrHanafi
    byId('ov-adhan-maghrib').value = (ov.adhan||{}).maghrib || '';
    byId('ov-adhan-isha').value = (ov.adhan||{}).isha || '';
    byId('ov-iqamah-fajr').value = (ov.iqamah||{}).fajr || '';
    byId('ov-iqamah-dhuhr').value = (ov.iqamah||{}).dhuhr || '';
    byId('ov-iqamah-asr').value = (ov.iqamah||{}).asr || '';
  // removed asrHanafi
    byId('ov-iqamah-maghrib').value = (ov.iqamah||{}).maghrib || '';
    byId('ov-iqamah-isha').value = (ov.iqamah||{}).isha || '';
    const host = byId('ov-jumuah'); host.innerHTML='';
    (ov.jumuah||[]).forEach(item=> addJumuahRow('ov', item));
  }
  // daily fill removed with new date-range workflow
  function mergeOverride(key){
    const ov = assignFields('ov');
    if(!data.months) data.months = {};
    data.months[key] = {
  sunrise: data.sunrise || undefined,
      note: ov.note || undefined,
      adhan: ov.adhan,
      iqamah: ov.iqamah,
      jumuah: ov.jumuah
    };
  }
  function applyRange(){
    const start = RANGE_START.value.trim();
    const endRaw = (RANGE_END.value || '').trim();
    if(!/^\d{4}-\d{2}-\d{2}$/.test(start)) return alert('Enter a valid start date (YYYY-MM-DD)');
    const end = endRaw && /^\d{4}-\d{2}-\d{2}$/.test(endRaw) ? endRaw : start;
    const vals = assignFields('rg');
    const startDate = new Date(start+'T00:00:00');
    const endDate = new Date(end+'T00:00:00');
    if(startDate > endDate) return alert('Start date must be on or before end date');
    if(!data.days) data.days = {};
    let count = 0;
    for(let d = new Date(startDate); d <= endDate; d.setDate(d.getDate()+1)){
      const key = d.toISOString().slice(0,10);
      data.days[key] = {
    sunrise: data.sunrise || undefined,
        note: vals.note || undefined,
        adhan: JSON.parse(JSON.stringify(vals.adhan)),
        iqamah: JSON.parse(JSON.stringify(vals.iqamah)),
        jumuah: Array.isArray(vals.jumuah) ? JSON.parse(JSON.stringify(vals.jumuah)) : []
      };
      count++;
    }
    alert(`Applied to ${count} day(s)`);
  }
  function download(){
    const key = MONTH_INPUT.value.trim();
    if(key && /^\d{4}-\d{2}$/.test(key)) mergeOverride(key);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prayer-times.json';
    a.click();
    URL.revokeObjectURL(url);
  }
  async function saveToServer(){
    const key = MONTH_INPUT.value.trim();
    if(key && /^\d{4}-\d{2}$/.test(key)) mergeOverride(key);
    // If root mostly empty but exactly one month override, promote it client-side too for immediate UX
    try {
      const monthKeys = data.months ? Object.keys(data.months) : [];
      const rootEmpty = (()=>{
        const a = data.adhan||{}; const i = data.iqamah||{};
        return !Object.values(a).some(v=>v) && !Object.values(i).some(v=>v);
      })();
      if(rootEmpty && monthKeys.length === 1){
        const mk = monthKeys[0]; const ov = data.months[mk];
        if(ov){
          if(ov.sunrise && !data.sunrise) data.sunrise = ov.sunrise;
          if(ov.note && !data.note) data.note = ov.note;
          if(ov.adhan) data.adhan = { ...(ov.adhan) };
            if(ov.iqamah) data.iqamah = { ...(ov.iqamah) };
            if(Array.isArray(ov.jumuah)) data.jumuah = JSON.parse(JSON.stringify(ov.jumuah));
        }
      }
    }catch{}
    // Pre-check admin role to avoid auth redirect causing fetch network/CORS error
    const isAdmin = await checkAdminRole();
    if(!isAdmin){
      console.warn('[admin] Not admin before save; redirecting to login');
      location.href = '/.auth/login/aad?post_login_redirect_uri=/admin-schedule.html';
      return;
    }
  if(btnSaveServer){ btnSaveServer.disabled = true; btnSaveServer.textContent = 'Saving…'; }
    try{
      const resp = await fetch('/api/prayer-times',{
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(data),
        credentials: 'include', // ensure auth cookies sent so admin role recognized
        cache: 'no-store'
      });
      if(resp.status === 307 || resp.status === 401){
        console.warn('[admin] Save POST got', resp.status, 'redirect/auth needed. Attempting role re-check then redirect.');
        // Re-check principal (maybe cookie missing)
        await showPrincipalDebug();
        location.href = '/.auth/login/aad?post_login_redirect_uri=/admin-schedule.html';
        return;
      }
      if(resp.status === 403){
        const txt = await resp.text();
        alert('Save blocked: '+txt+'\nIf this is local dev and you want to bypass, set DEV_ALLOW_NON_ADMIN=1 in Functions environment or add admin role.');
        return;
      }
      if(resp.status === 404){
        alert('Save failed: API endpoint not found. Likely the Functions API has not been deployed yet. Ensure GitHub Action ran successfully or manual deploy completed.');
        return;
      }
      if(resp.status === 405){
        alert('Save failed: Method not allowed. This often means the API function is missing or not built. Re-deploy the Functions API.');
        return;
      }
      if(resp.status === 503){
        const txt = await resp.text();
        alert('Save failed (storage unavailable): ' + txt + '\nCheck storage app settings and managed identity role.');
        return;
      }
      if(!resp.ok){
        const txt = await resp.text();
        alert('Save failed ('+resp.status+'): ' + txt);
        return;
      }
      alert('Saved successfully');
    }catch(err){
      alert('Save failed: network error (possibly transient). If you were just redirected or lost connectivity, retry.');
    }
    finally {
      if(btnSaveServer){ btnSaveServer.disabled = false; btnSaveServer.textContent = 'Save to Server'; }
    }
  }
  async function checkAdminRole(){
    try{
      // Try cached principal first for immediate UX continuity
      let cachedPrincipal = null;
      try{ const raw = localStorage.getItem('swaAuthPrincipal'); if(raw) cachedPrincipal = JSON.parse(raw); }catch{}
      if(cachedPrincipal && authStatusEl){
        const rolesC = cachedPrincipal.userRoles||[];
        const firstC = firstNameOf(cachedPrincipal.userDetails||cachedPrincipal.identityProvider||'');
        authStatusEl.textContent = rolesC.includes('admin') ? `Signed in as ${firstC} (admin)` : `Signed in as ${firstC} (no admin role)`;
      }
  const resp = await fetch('/.auth/me', { cache: 'no-store', credentials:'include' });
      if(!resp.ok) return false;
      const info = await resp.json();
      const principal = info && info.clientPrincipal;
      const roles = (principal && principal.userRoles) || [];
      const firstName = principal ? firstNameOf(principal.userDetails || principal.identityProvider || '') : '';
      if(authStatusEl){
        if(!principal){
          authStatusEl.textContent = 'Not signed in (admin required for saving)';
        } else {
          const base = firstName ? `Signed in as ${firstName}` : 'Signed in';
          authStatusEl.textContent = roles.includes('admin') ? `${base} (admin)` : `${base} (no admin role)`;
        }
      }
      return roles.includes('admin');
    }catch{ return false; }
  }
  async function showPrincipalDebug(){
    try{
  const resp = await fetch('/api/me', { credentials:'include' });
      if(!resp.ok) return;
      const dataDbg = await resp.json();
      if(authStatusEl && dataDbg && dataDbg.principal){
        const roles = dataDbg.principal.userRoles || [];
  const raw = dataDbg.principal.userDetails || 'unknown';
  const first = firstNameOf(raw) || raw;
  authStatusEl.textContent = `Signed in as ${first} | Roles: ${roles.join(', ')}`;
  try{ localStorage.setItem('swaAuthPrincipal', JSON.stringify(dataDbg.principal)); }catch{}
      }
    }catch{}
  }
  async function fetchFromServer(){
    try{
      const resp = await fetch('/api/prayer-times');
      if(resp.status === 404){
        alert('Fetch failed: API endpoint not found. Ensure deployment with managed Functions succeeded.');
        return;
      }
      if(!resp.ok){
        const txt = await resp.text();
        alert('Fetch failed ('+resp.status+'): '+txt);
        return;
      }
      const obj = await resp.json();
      data = { ...obj };
      // Refresh current month override display
      const key = MONTH_INPUT.value.trim();
      if(key) fillOverride(key);
      alert('Fetched server copy into editor (remember to Download or Save to Server to persist local edits).');
    }catch(err){
      alert('Fetch failed: network error');
    }
  }
  function importJson(){ fileInput.click(); }
  fileInput.addEventListener('change', (e)=>{
    const f = e.target.files && e.target.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      try{
        const obj = JSON.parse(reader.result);
    data = { updated: new Date().toISOString().slice(0,10), months:{}, ...obj };
        const key = MONTH_INPUT.value.trim();
        if(key) fillOverride(key);
      }catch(err){ alert('Invalid JSON'); }
    };
    reader.readAsText(f);
  });

  btnLoad.addEventListener('click', importJson);
  btnFillMonthFromDefaults.addEventListener('click', fillMonthFromDefaults);
  if(btnFetchServer) btnFetchServer.addEventListener('click', fetchFromServer);
  if(btnApplyRange) btnApplyRange.addEventListener('click', applyRange);
  btnDownload.addEventListener('click', download);
  btnSaveServer.addEventListener('click', saveToServer);
  btnReset.addEventListener('click', ()=>{ location.reload(); });
  byId('ov-add-jumuah').addEventListener('click', ()=> addJumuahRow('ov'));
  byId('rg-add-jumuah').addEventListener('click', ()=> addJumuahRow('rg'));
  MONTH_INPUT.addEventListener('change', ()=> fillOverride(MONTH_INPUT.value.trim()));
  if(btnThisMonth) btnThisMonth.addEventListener('click', ()=>{
    const d = new Date(); setRangeTo(d.getFullYear(), d.getMonth());
  });
  if(btnPrevMonth) btnPrevMonth.addEventListener('click', ()=>{
    const d = new Date(); const y = d.getFullYear(); const m = d.getMonth();
    const ym = m === 0 ? { y: y-1, m: 11 } : { y, m: m-1 };
    setRangeTo(ym.y, ym.m);
  });
  if(btnNextMonth) btnNextMonth.addEventListener('click', ()=>{
    const d = new Date(); const y = d.getFullYear(); const m = d.getMonth();
    const ym = m === 11 ? { y: y+1, m: 0 } : { y, m: m+1 };
    setRangeTo(ym.y, ym.m);
  });
  if(btnSetMonth) btnSetMonth.addEventListener('click', ()=>{
    const v = (presetMonthInput && presetMonthInput.value || '').trim();
    if(!/^\d{4}-\d{2}$/.test(v)) return alert('Enter month as YYYY-MM');
    const [yy, mm] = v.split('-').map(Number);
    setRangeTo(yy, mm-1);
  });
  // Auto-save removed with new range workflow

  // Init with current month key
  const d = new Date();
  MONTH_INPUT.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  if(RANGE_START) RANGE_START.value = d.toISOString().slice(0,10);
  if(RANGE_END) RANGE_END.value = d.toISOString().slice(0,10);
  fillOverride(MONTH_INPUT.value.trim());
  // Kick off auth status detection
  checkAdminRole().then(()=> showPrincipalDebug());

  /* ================= Sunrise Auto-Fetch ================= */
  const btnRefreshSun = document.getElementById('btn-refresh-sun');
  const sunriseBadge = document.getElementById('sunrise-badge');
  async function fetchSunrise(){
    if(!sunriseBadge) return;
    sunriseBadge.textContent = 'Loading…';
    sunriseBadge.classList.remove('bg-warning','bg-danger');
    sunriseBadge.classList.add('bg-info');
    try{
      // Assumption: Mosque location coordinates (adjust as needed)
      const lat = 47.744; // TODO: update with real latitude
      const lng = -121.985; // TODO: update with real longitude
      const resp = await fetch(`https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&formatted=0`);
      if(!resp.ok) throw new Error('HTTP '+resp.status);
      const obj = await resp.json();
      if(!obj || obj.status !== 'OK' || !obj.results) throw new Error('Invalid API response');
      const sunriseISO = obj.results.sunrise; // UTC ISO
      const localDate = new Date(sunriseISO);
      const hhmm = to12h(localDate);
      data.sunrise = hhmm;
      sunriseBadge.textContent = hhmm;
      sunriseBadge.classList.remove('bg-info');
      sunriseBadge.classList.add('bg-success');
      // Update any preview
      buildPreviewGrid();
    }catch(err){
      sunriseBadge.textContent = 'Error';
      sunriseBadge.classList.remove('bg-info');
      sunriseBadge.classList.add('bg-danger');
      console.error('[sunrise] fetch failed', err);
    }
  }
  if(btnRefreshSun) btnRefreshSun.addEventListener('click', fetchSunrise);

  function to12h(d){
    let h = d.getHours();
    const m = d.getMinutes();
    const ampm = h>=12 ? 'PM':'AM';
    h = h%12; if(h===0) h=12;
    return `${h}:${String(m).padStart(2,'0')} ${ampm}`;
  }

  /* ================= Preview Grid ================= */
  const previewGridHost = document.getElementById('preview-grid');
  const btnRefreshPreview = document.getElementById('btn-refresh-preview');
  function currentRoot(){
    return {
      fajr: { adhan: (data.adhan||{}).fajr||'', iqamah: (data.iqamah||{}).fajr||'' },
      dhuhr: { adhan: (data.adhan||{}).dhuhr||'', iqamah: (data.iqamah||{}).dhuhr||'' },
      asr: { adhan: (data.adhan||{}).asr||'', iqamah: (data.iqamah||{}).asr||'' },
      maghrib: { adhan: (data.adhan||{}).maghrib||'', iqamah: (data.iqamah||{}).maghrib||'' },
      isha: { adhan: (data.adhan||{}).isha||'', iqamah: (data.iqamah||{}).isha||'' }
    };
  }
  function readWorkingValues(){
    // Reads current form (root override fields with prefix ov-)
    const get = id=> (document.getElementById(id) || {}).value || '';
    return {
      fajr: { adhan: get('ov-adhan-fajr'), iqamah: get('ov-iqamah-fajr') },
      dhuhr: { adhan: get('ov-adhan-dhuhr'), iqamah: get('ov-iqamah-dhuhr') },
      asr: { adhan: get('ov-adhan-asr'), iqamah: get('ov-iqamah-asr') },
      maghrib: { adhan: get('ov-adhan-maghrib'), iqamah: get('ov-iqamah-maghrib') },
      isha: { adhan: get('ov-adhan-isha'), iqamah: get('ov-iqamah-isha') }
    };
  }
  function buildPreviewGrid(){
    if(!previewGridHost) return;
    const work = readWorkingValues();
    // Show 4 core prayers in 2x2 (Fajr, Dhuhr, Asr, Maghrib). Isha can appear on large screens or tooltip.
    const order = ['fajr','dhuhr','asr','maghrib'];
    previewGridHost.innerHTML = '';
    order.forEach(name=>{
      const rec = work[name];
      const div = document.createElement('div');
      div.className = 'preview-item';
      div.innerHTML = `
        <div class="name">${name.charAt(0).toUpperCase()+name.slice(1)}</div>
        <div class="times">${rec.adhan||'--'} / <strong>${rec.iqamah||'--'}</strong></div>
      `;
      previewGridHost.appendChild(div);
    });
    // Optionally append sunrise badge mini or Isha below
    if(data.sunrise){
      const sunriseDiv = document.createElement('div');
      sunriseDiv.className = 'preview-item';
      sunriseDiv.innerHTML = `<div class="name">Sunrise</div><div class="times">${data.sunrise}</div>`;
      previewGridHost.appendChild(sunriseDiv);
    }
  // Update dedicated Fajr 2x2 grid if present
  const fgAdhan = document.getElementById('fg-adhan');
  const fgIqamah = document.getElementById('fg-iqamah');
  if(fgAdhan) fgAdhan.textContent = work.fajr.adhan || '--';
  if(fgIqamah) fgIqamah.textContent = work.fajr.iqamah || '--';
  }
  if(btnRefreshPreview) btnRefreshPreview.addEventListener('click', buildPreviewGrid);
  // Auto update preview on input changes (debounced)
  let previewTimer = null;
  document.addEventListener('input', (e)=>{
    if(!(e.target instanceof HTMLElement)) return;
    if(!e.target.closest('#root-override-section')) return; // scope limit
    clearTimeout(previewTimer);
    previewTimer = setTimeout(buildPreviewGrid, 300);
  });

  // Initial preview + sunrise fetch
  buildPreviewGrid();
  fetchSunrise();
})();

function firstNameOf(details){
  if(!details) return '';
  let raw = details.includes('@') ? details.split('@')[0] : details.split(/\s+/)[0];
  raw = raw.replace(/[^A-Za-z0-9_-]/g,' ').trim();
  if(!raw) return '';
  return raw.charAt(0).toUpperCase()+raw.slice(1);
}

