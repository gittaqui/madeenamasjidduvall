// Archived: see _archive/schedule-admin.js
    byId('ov-adhan-fajr').value = (source.adhan||{}).fajr || '';
    byId('ov-adhan-dhuhr').value = (source.adhan||{}).dhuhr || '';
    byId('ov-adhan-asr').value = (source.adhan||{}).asr || '';
    byId('ov-adhan-maghrib').value = (source.adhan||{}).maghrib || '';
    byId('ov-adhan-isha').value = (source.adhan||{}).isha || '';
    byId('ov-iqamah-fajr').value = (source.iqamah||{}).fajr || '';
    byId('ov-iqamah-dhuhr').value = (source.iqamah||{}).dhuhr || '';
    byId('ov-iqamah-asr').value = (source.iqamah||{}).asr || '';
    byId('ov-iqamah-maghrib').value = (source.iqamah||{}).maghrib || '';
    byId('ov-iqamah-isha').value = (source.iqamah||{}).isha || '';
    const host = byId('ov-jumuah'); host.innerHTML='';
    (source.jumuah||[]).forEach(item=> addJumuahRow('ov', item));
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
    const ov = assignFields();
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
  const vals = assignFields();
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
    // API call removed: update prayer-times.json manually or via static file upload.
    alert('Prayer times update: please upload or edit prayer-times.json directly.');
    if(btnSaveServer){ btnSaveServer.disabled = false; btnSaveServer.textContent = 'Save to Server'; }
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
    // API call removed: load prayer-times.json directly.
    try{
      const resp = await fetch('prayer-times.json');
      if(!resp.ok) throw new Error('Failed to load prayer times');
      const obj = await resp.json();
      data = { ...obj };
      // Refresh current month override display
      const key = MONTH_INPUT.value.trim();
      if(key) fillOverride(key);
      alert('Loaded prayer-times.json into editor.');
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
  byId('ov-add-jumuah').addEventListener('click', ()=> addJumuahRow());
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
  // If hosted on SWA and no local months loaded yet, attempt auto-fetch once to populate defaults
  setTimeout(()=>{
    try{
      const host = location.hostname;
      if((!data.months || Object.keys(data.months).length===0) && /azurestaticapps\.net$/i.test(host)){
        fetchFromServer();
      }
    }catch{}
  },200);

  // Sunrise fetch (Duvall, WA) using sunrise-sunset.org
  const btnRefreshSun = document.getElementById('btn-refresh-sun');
  async function fetchSunrise(){
    if(!btnRefreshSun) return;
    const original = btnRefreshSun.textContent;
    btnRefreshSun.disabled = true; btnRefreshSun.textContent = 'Fetching…';
    try {
      const lat = 47.742; // Duvall approximate latitude
      const lng = -121.985; // Duvall approximate longitude
      const resp = await fetch(`https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&formatted=0`);
      if(!resp.ok) throw new Error('HTTP '+resp.status);
      const body = await resp.json();
      if(body.status !== 'OK') throw new Error('API status '+body.status);
      const sunriseUTC = new Date(body.results.sunrise);
      // Convert to local time string 12h
      const h12 = (dt)=>{ let h=dt.getHours(), m=dt.getMinutes(); const ap=h>=12?'PM':'AM'; h=h%12||12; return `${h}:${String(m).padStart(2,'0')} ${ap}`; };
      data.sunrise = h12(sunriseUTC);
      console.log('[sunrise] Updated sunrise to', data.sunrise);
      btnRefreshSun.textContent = 'Sunrise: '+data.sunrise;
    }catch(err){
      console.error('[sunrise] fetch failed', err);
      btnRefreshSun.textContent = 'Sunrise Error';
      setTimeout(()=> btnRefreshSun.textContent = original, 3000);
    }finally{
      btnRefreshSun.disabled = false;
    }
  }
  if(btnRefreshSun) btnRefreshSun.addEventListener('click', fetchSunrise);
  // Initial auto fetch once per page load
  fetchSunrise();

})();

function firstNameOf(details){
  if(!details) return '';
  let raw = details.includes('@') ? details.split('@')[0] : details.split(/\s+/)[0];
  raw = raw.replace(/[^A-Za-z0-9_-]/g,' ').trim();
  if(!raw) return '';
  return raw.charAt(0).toUpperCase()+raw.slice(1);
}

