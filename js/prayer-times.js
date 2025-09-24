// Populate prayer times placeholder from prayer-times.json (supports flat or adhan/iqamah schema)
(function(){
  const URL = '/api/prayer-times';
  function set(el, val){ if(el) el.textContent = val || '—'; }
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
  function pick(valA, valB, valC){ return valA || valB || valC || '—'; }
  function formatJumuah(j){
    if(!j) return '—';
    if(Array.isArray(j) && j.length){
      const first = j[0];
      // Support either {title,start,end} or {khutbah,salah}
      if(first && (first.start || first.end)){
        const title = first.title ? `${first.title} ` : '';
        const range = [first.start, first.end].filter(Boolean).join('–');
        return `${title}${range}`.trim() || '—';
      }
      if(first && (first.khutbah || first.salah)){
        return [first.khutbah && `Khutbah ${first.khutbah}`, first.salah && `Salah ${first.salah}`].filter(Boolean).join(' · ');
      }
    }
    return typeof j === 'string' ? j : '—';
  }
  async function load(){
    const box = document.getElementById('prayer-times');
    if(!box) return;
    try{
      const res = await fetch(URL, { cache: 'no-store' });
      if(!res.ok) throw new Error('Failed to load prayer-times.json');
      let data = await res.json();
  data = applyMonth(data);
  data = applyDay(data);
      const adhan = data.adhan || {};
      const iqamah = data.iqamah || {};
      // Support flat schema fallback
      set(box.querySelector('[data-key="fajr"]'), pick(iqamah.fajr, adhan.fajr, data.fajr));
      set(box.querySelector('[data-key="dhuhr"]'), pick(iqamah.dhuhr, adhan.dhuhr, data.dhuhr));
      set(box.querySelector('[data-key="asr"]'), pick(iqamah.asr, adhan.asr, data.asr));
      set(box.querySelector('[data-key="maghrib"]'), pick(iqamah.maghrib, adhan.maghrib, data.maghrib));
      set(box.querySelector('[data-key="isha"]'), pick(iqamah.isha, adhan.isha, data.isha));
      set(box.querySelector('[data-key="jumuah"]'), formatJumuah(data.jumuah));
      if(data.note) set(box.querySelector('[data-key="note"]'), data.note);
    }catch(e){
      // keep placeholders
      console.warn('Prayer times unavailable:', e);
    }
  }
  document.addEventListener('DOMContentLoaded', load);
})();
