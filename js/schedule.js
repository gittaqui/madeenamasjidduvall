// Build vertical schedule from prayer-times.json and compute countdown to next iqamah
(function(){
  // Allow overriding API base (e.g., when BYO Azure Function not yet linked) via global window.PRAYER_TIMES_API_BASE
  const URL = (window.PRAYER_TIMES_API_BASE || '') + '/api/prayer-times';
  const PT = 'America/Los_Angeles';
  function getPTYMD(){
    const now = new Date();
    const fmt = new Intl.DateTimeFormat('en-US',{ timeZone: PT, year:'numeric', month:'2-digit', day:'2-digit', weekday:'short' });
    const parts = fmt.formatToParts(now).reduce((acc,p)=>{ acc[p.type]=p.value; return acc; },{});
    const y = Number(parts.year);
    const m = Number(parts.month);
    const d = Number(parts.day);
    return { y, m, d, weekday: parts.weekday };
  }
  function parseTimeFlexible(str){
    if(!str) return null;
    const cleaned = str.trim().replace(/\u00A0/g,' ').replace(/\s+/g,' ');
    // Match 12h anywhere: 1:05 PM, 1:05pm, 1:05 p.m., even with trailing text
    let m = cleaned.match(/(\d{1,2}):(\d{2})\s*([AaPp])\.?\s*[Mm]\.?/);
    if(m){
      let hh = parseInt(m[1],10); const mm = parseInt(m[2],10); const ap = m[3].toUpperCase();
      if(ap === 'P' && hh !== 12) hh += 12;
      if(ap === 'A' && hh === 12) hh = 0;
      return { hh, mm };
    }
    // Match 24h anywhere: 13:05
    m = cleaned.match(/(\d{1,2}):(\d{2})/);
    if(m){
      let hh = parseInt(m[1],10); const mm = parseInt(m[2],10);
      if(hh>=0 && hh<=23 && mm>=0 && mm<=59) return { hh, mm };
    }
    return null;
  }
  function getPTNowParts(){
    const now = new Date();
    const fmt = new Intl.DateTimeFormat('en-US',{ timeZone: PT, hourCycle:'h23', hour:'2-digit', minute:'2-digit', second:'2-digit', year:'numeric', month:'2-digit', day:'2-digit', weekday:'short' });
    const parts = fmt.formatToParts(now).reduce((acc,p)=>{ acc[p.type]=p.value; return acc; },{});
    return {
      y: Number(parts.year), m: Number(parts.month), d: Number(parts.day),
      weekday: parts.weekday, hh: Number(parts.hour), mm: Number(parts.minute), ss: Number(parts.second)
    };
  }
  function msUntilTodayPT(str){
    const t = parseTimeFlexible(str);
    if(!t) return null;
    const nowPT = getPTNowParts();
    // same-day only comparison (we rebuild daily)
    const nowMin = nowPT.hh*60 + nowPT.mm + nowPT.ss/60;
    const tgtMin = t.hh*60 + t.mm;
    const deltaMin = tgtMin - nowMin;
    if(deltaMin <= 0) return null;
    return Math.floor(deltaMin*60*1000);
  }
  function monthKey(d){
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    return `${y}-${m}`;
  }
  function deepMerge(base, ov){
    if(!ov) return base;
    const out = Array.isArray(base) ? [...base] : { ...(base||{}) };
    for(const k of Object.keys(ov)){
      const b = out[k];
      const v = ov[k];
      if(b && typeof b === 'object' && !Array.isArray(b) && v && typeof v === 'object' && !Array.isArray(v)){
        out[k] = deepMerge(b, v);
      } else {
        out[k] = v;
      }
    }
    return out;
  }
  function applyMonth(data){
    try{
      if(data && data.months && typeof data.months === 'object'){
        const key = monthKey(new Date());
        if(data.months[key]){
          const clone = { ...data };
          delete clone.months;
          return deepMerge(clone, data.months[key]);
        }
      }
    }catch{}
    return data;
  }
  function applyDay(data){
    try{
      if(data && data.days && typeof data.days === 'object'){
        const key = new Date().toISOString().slice(0,10);
        if(data.days[key]){
          const clone = { ...data };
          delete clone.days;
          return deepMerge(clone, data.days[key]);
        }
      }
    }catch{}
    return data;
  }
  const ROWS = [
    { key: 'fajr', label: 'Fajr' },
    { key: 'dhuhr', label: 'Dhuhr' },
    { key: 'asr', label: 'Asr' },
    { key: 'maghrib', label: 'Maghrib' },
    { key: 'isha', label: 'Isha' }
  ];
  // toTodayTime replaced by toPTDateTime for PT-consistent calculations
  function fmtNow(){
    const d = new Date();
    return d.toLocaleString(undefined, { timeZone: PT, month:'short', day:'2-digit', year:'numeric', hour:'numeric', minute:'2-digit', second:'2-digit', timeZoneName:'short' });
  }
  function pad(n){ return String(n).padStart(2,'0'); }
  function diffHHMMSSFromMs(ms){
    if(ms == null || isNaN(ms)) return '—';
    if(ms <= 0) return '00:00:00';
    const s = Math.floor(ms/1000);
    const h = Math.floor(s/3600);
    const m = Math.floor((s%3600)/60);
    const ss = s%60;
    return `${pad(h)}:${pad(m)}:${pad(ss)}`;
  }
  function splitHMS(ms){
    if(ms == null || isNaN(ms) || ms <= 0){
      return { h:'00', m:'00', s:'00' };
    }
    const totalSeconds = Math.floor(ms/1000);
    const h = Math.floor(totalSeconds/3600);
    const m = Math.floor((totalSeconds%3600)/60);
    const s = totalSeconds%60;
    return { h: pad(h), m: pad(m), s: pad(s) };
  }
  function nextIqamah(data){
    // Build a list of future iqamah Date objects
    const list = [];
    ROWS.forEach(r => {
      const adhanStr = data.adhan && data.adhan[r.key];
      const iqamahStr = (r.iqamah === false) ? null : data.iqamah && data.iqamah[r.key];
      const ms = msUntilTodayPT(iqamahStr);
      if(ms && ms > 0){
        list.push({ key: r.key, label: r.label, ms, adhan: adhanStr, iqamah: iqamahStr });
      }
    });
    // On Friday (PT), include Jumu'ah sessions as candidates using salah or start time
    const { weekday } = getPTYMD();
    if(/fri/i.test(weekday || '')){
      const sessions = Array.isArray(data.jumuah) ? data.jumuah : [];
      sessions.forEach(s => {
        const jumStr = s.salah || s.start;
        const ms = msUntilTodayPT(jumStr);
        if(ms && ms > 0){
          const label = 'Jummah';
          list.push({ key: 'jumuah', label, ms, adhan: null, iqamah: jumStr });
        }
      });
    }
    list.sort((a,b)=> a.ms - b.ms);
    return list[0] || null;
  }
  function buildRows(data){
    const tbody = document.getElementById('prayer-rows');
    if(!tbody) return;
    tbody.innerHTML = '';
    ROWS.forEach(r => {
      const adhanStr = data.adhan && data.adhan[r.key];
      const iqamahStr = (r.iqamah === false) ? '' : (data.iqamah && data.iqamah[r.key]) || '';
      const tr = document.createElement('tr');
      const th = document.createElement('th'); th.textContent = r.label; tr.appendChild(th);
  const tdAdhan = document.createElement('td');
  tdAdhan.textContent = adhanStr || '';
  tdAdhan.classList.add('adhan-cell');
  tr.appendChild(tdAdhan);
  const tdIqamah = document.createElement('td');
  tdIqamah.textContent = iqamahStr;
  tdIqamah.classList.add('iqamah-cell');
  tr.appendChild(tdIqamah);
      tbody.appendChild(tr);
    });
  }
  function buildJumuah(data){
    const ul = document.getElementById('jumuah-list');
    if(!ul) return;
    ul.innerHTML = '';
    const arr = Array.isArray(data.jumuah) ? data.jumuah : [];
    arr.forEach(item => {
      const li = document.createElement('li');
      if(item.title && item.start && item.end){
        li.textContent = `${item.title} ${item.start} - ${item.end}`;
      } else if(item.khutbah || item.salah){
        li.textContent = [item.khutbah && `Khutbah ${item.khutbah}`, item.salah && `Salah ${item.salah}`].filter(Boolean).join(' · ');
      }
      ul.appendChild(li);
    });
  }
  function applyData(data){
    buildRows(data);
    buildJumuah(data);
    document.getElementById('now-datetime').textContent = fmtNow();
    // mirror local time into #localtime if new widget exists
    const localEl = document.getElementById('localtime');
    if(localEl) localEl.textContent = fmtNow();
    const next = nextIqamah(data);
    if(next){
      const legacyNameEl = document.getElementById('next-iqamah-name');
      const newNameEl = document.getElementById('next-iqamah');
      const targetNameEl = newNameEl || legacyNameEl;
      if(targetNameEl) targetNameEl.textContent = `${next.label} iqamah`;
      const etaEl = document.getElementById('next-iqamah-eta');
      const parts = splitHMS(next.ms);
      if(etaEl){ etaEl.textContent = `${parts.h}:${parts.m}:${parts.s}`; etaEl.title = `at ${next.iqamah}`; }
      // populate new split countdown parts if present
      const cdH = document.getElementById('cd-hours');
      const cdM = document.getElementById('cd-minutes');
      const cdS = document.getElementById('cd-seconds');
      if(cdH) cdH.textContent = parts.h;
      if(cdM) cdM.textContent = parts.m;
      if(cdS) cdS.textContent = parts.s;
    } else {
      const legacyNameEl = document.getElementById('next-iqamah-name');
      const newNameEl = document.getElementById('next-iqamah');
      if(legacyNameEl) legacyNameEl.textContent = '—';
      if(newNameEl) newNameEl.textContent = '—';
      const etaEl = document.getElementById('next-iqamah-eta');
      if(etaEl) etaEl.textContent = '—';
      ['cd-hours','cd-minutes','cd-seconds'].forEach(id=>{ const el = document.getElementById(id); if(el) el.textContent = '00'; });
    }
    const note = document.getElementById('prayer-note');
    if(data.note && note) note.textContent = data.note;
    // Sun times fetch (only once per applyData call for current day)
    fetchSunTimes();
  }
  let sunTimesFetched = false;
  async function fetchSunTimes(){
    if(sunTimesFetched) return; // avoid repeated fetches during countdown
    sunTimesFetched = true;
    const sunriseEl = document.getElementById('sunrise-display');
    const sunsetEl = document.getElementById('sunset-display');
    try {
      const lat = 47.742; // Duvall, WA
      const lng = -121.985;
      const resp = await fetch(`https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&formatted=0`);
      if(!resp.ok) throw new Error('HTTP '+resp.status);
      const obj = await resp.json();
      if(obj.status !== 'OK') throw new Error('API status '+obj.status);
      const to12 = dt=>{ let h=dt.getHours(); const m=dt.getMinutes(); const ap=h>=12?'PM':'AM'; h=h%12||12; return `${h}:${String(m).padStart(2,'0')} ${ap}`; };
      const sr = new Date(obj.results.sunrise);
      const ss = new Date(obj.results.sunset);
      if(sunriseEl) sunriseEl.textContent = to12(sr);
      if(sunsetEl) sunsetEl.textContent = to12(ss);
    }catch(e){
      if(sunriseEl) sunriseEl.textContent = 'n/a';
      if(sunsetEl) sunsetEl.textContent = 'n/a';
      console.warn('Sun times fetch failed', e);
    }
  }
  let dayOffset = 0; // 0 = today, -1 = yesterday, +1 = tomorrow
  function formatPTDate(y,m,d){
    const dt = new Date(Date.UTC(y, m-1, d));
    return dt.toLocaleDateString(undefined, { timeZone: PT, month:'short', day:'2-digit', year:'numeric', weekday:'long' });
  }
  function offsetDateISO(offset){
    const now = new Date();
    now.setDate(now.getDate()+offset);
    return now.toISOString().slice(0,10);
  }
  function renderForOffset(raw){
    // raw is the base data (with months/days maps preserved)
    const iso = offsetDateISO(dayOffset);
    let d = JSON.parse(JSON.stringify(raw));
    // apply month override based on that date
    try{
      if(d.months){
        const dt = new Date(iso+'T00:00:00');
        const mk = monthKey(dt);
        if(d.months[mk]){
          const clone = { ...d };
          delete clone.months;
          d = deepMerge(clone, d.months[mk]);
        }
      }
    }catch{}
    try{
      if(d.days && d.days[iso]){
        const clone = { ...d };
        delete clone.days;
        d = deepMerge(clone, d.days[iso]);
      }
    }catch{}
  // update picker and label
    const lbl = document.getElementById('sched-date-label');
  const picker = document.getElementById('sched-date');
    if(lbl){
      if(dayOffset === 0){ lbl.textContent = 'Today'; }
      else {
        const [y,m,dd] = iso.split('-').map(n=>parseInt(n,10));
        lbl.textContent = formatPTDate(y,m,dd);
      }
    }
  if(picker){ picker.value = iso; }
    // when not today, we won’t show a running countdown
    if(dayOffset !== 0){
      buildRows(d);
      buildJumuah(d);
      const nameEl = document.getElementById('next-iqamah-name');
      const etaEl = document.getElementById('next-iqamah-eta');
      nameEl.textContent = '—';
      etaEl.textContent = '—';
      etaEl.removeAttribute('title');
      return;
    }
    applyData(d);
  }
  async function load(){
    const box = document.getElementById('prayer-schedule');
    if(!box) return;
    try{
      const res = await fetch(URL, { cache: 'no-store' });
      if(!res.ok) throw new Error('Failed to load prayer-times.json');
      const raw = await res.json();
      renderForOffset(raw);
      // update countdown every second
      setInterval(()=>{
        if(dayOffset === 0){
          const res = nextIqamah((()=>{
            // recompute today view from raw quickly
            let d = JSON.parse(JSON.stringify(raw));
            d = applyMonth(d);
            d = applyDay(d);
            return d;
          })());
          const nameEl = document.getElementById('next-iqamah-name');
          const etaEl = document.getElementById('next-iqamah-eta');
          if(res){
            const newNameCombined = `${res.label} iqamah`;
            const legacyNameEl = document.getElementById('next-iqamah-name');
            const newNameEl = document.getElementById('next-iqamah');
            const targetNameEl = newNameEl || legacyNameEl;
            if(targetNameEl && targetNameEl.textContent !== newNameCombined){
              targetNameEl.textContent = newNameCombined;
              targetNameEl.classList.add('pulsing');
              setTimeout(()=> targetNameEl.classList.remove('pulsing'), 3500);
            }
            const parts = splitHMS(res.ms);
            const newEta = `${parts.h}:${parts.m}:${parts.s}`;
            if(etaEl && etaEl.textContent !== newEta){
              etaEl.textContent = newEta;
              etaEl.classList.add('updated');
              setTimeout(()=> etaEl.classList.remove('updated'), 450);
              etaEl.title = `at ${res.iqamah}`;
            }
            // update split countdown pieces
            const cdH = document.getElementById('cd-hours');
            const cdM = document.getElementById('cd-minutes');
            const cdS = document.getElementById('cd-seconds');
            if(cdH && cdH.textContent !== parts.h){ cdH.textContent = parts.h; cdH.classList.add('updated'); setTimeout(()=>cdH.classList.remove('updated'),450); }
            if(cdM && cdM.textContent !== parts.m){ cdM.textContent = parts.m; cdM.classList.add('updated'); setTimeout(()=>cdM.classList.remove('updated'),450); }
            if(cdS && cdS.textContent !== parts.s){ cdS.textContent = parts.s; cdS.classList.add('updated'); setTimeout(()=>cdS.classList.remove('updated'),450); }
          } else {
            if(nameEl) nameEl.textContent = '—';
            const newNameEl = document.getElementById('next-iqamah');
            if(newNameEl) newNameEl.textContent = '—';
            if(etaEl){ etaEl.textContent = '—'; etaEl.removeAttribute('title'); }
            ['cd-hours','cd-minutes','cd-seconds'].forEach(id=>{ const el = document.getElementById(id); if(el) el.textContent = '00'; });
          }
          const nowStr = fmtNow();
          const nowEl = document.getElementById('now-datetime');
          if(nowEl) nowEl.textContent = nowStr;
          const localEl = document.getElementById('localtime');
          if(localEl) localEl.textContent = nowStr;
        }
      }, 1000);
      // bind nav buttons
      const prevBtn = document.getElementById('sched-prev');
      const nextBtn = document.getElementById('sched-next');
      const todayBtn = document.getElementById('sched-today');
      const picker = document.getElementById('sched-date');
      if(prevBtn) prevBtn.addEventListener('click', ()=>{ dayOffset -= 1; renderForOffset(raw); });
      if(nextBtn) nextBtn.addEventListener('click', ()=>{ dayOffset += 1; renderForOffset(raw); });
      if(todayBtn) todayBtn.addEventListener('click', ()=>{ dayOffset = 0; renderForOffset(raw); });
      if(picker) picker.addEventListener('change', ()=>{
        const val = picker.value;
        if(/^\d{4}-\d{2}-\d{2}$/.test(val)){
          const today = new Date().toISOString().slice(0,10);
          const diff = Math.round((new Date(val) - new Date(today))/86400000);
          dayOffset = diff;
          renderForOffset(raw);
        }
      });
    }catch(e){
      console.warn('Schedule unavailable:', e);
    }
  }
  document.addEventListener('DOMContentLoaded', load);
})();
