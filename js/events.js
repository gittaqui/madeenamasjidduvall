// Dynamic events renderer for Madeena Masjid Duvall
(function(){
  const CONFIG_URL = 'site-config.json';
  const EVENTS_JSON_FALLBACK = 'events.json';
  function fmtDate(iso){
    try{
      const d = new Date(iso + 'T00:00:00');
      const day = d.toLocaleDateString(undefined,{ day:'2-digit'});
      const mon = d.toLocaleDateString(undefined,{ month:'short'});
      const yr = d.getFullYear();
      return `${day} ${mon} ${yr}`;
    }catch{ return iso; }
  }
  function weekdayAndTime(iso, time){
    try{
      const d = new Date(iso + (time?`T${time}:00`:'T00:00:00'));
      const wd = d.toLocaleDateString(undefined,{ weekday:'short'});
      const tm = time ? time : d.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});
      return `${wd} ${tm}`;
    }catch{ return time || ''; }
  }
  function cardHtml(ev, delay){
    const dateStr = fmtDate(ev.date);
    const whenStr = weekdayAndTime(ev.date, ev.time);
    const safeImg = ev.image || 'img/events-1.jpg';
    return `
      <div class="row g-4 event-item wow fadeIn" data-wow-delay="${delay}s">
        <div class="col-3 col-lg-2 pe-0">
          <div class="text-center border-bottom border-dark py-3 px-2">
            <h6>${dateStr}</h6>
            <p class="mb-0">${whenStr}</p>
          </div>
        </div>
        <div class="col-9 col-lg-6 border-start border-dark pb-5">
          <div class="ms-3">
            <h4 class="mb-2">${ev.title}</h4>
            <p class="mb-0">${ev.description || ''}</p>
          </div>
        </div>
        <div class="col-12 col-lg-4">
          <div class="overflow-hidden mb-5">
            <img src="${safeImg}" class="img-fluid w-100" alt="">
          </div>
        </div>
      </div>`;
  }
  async function load(){
    const container = document.getElementById('events-list');
    if(!container) return;
    try{
      let all = [];
      try {
        const cfgResp = await fetch(CONFIG_URL, { cache:'no-store' });
        if(cfgResp.ok){
          const cfg = await cfgResp.json();
          if(cfg && Array.isArray(cfg.events)) all = cfg.events;
        }
      } catch{/* ignore */}
      if(!all.length){
        const resp = await fetch(EVENTS_JSON_FALLBACK, { cache: 'no-store' });
        if(resp.ok){ all = await resp.json(); }
      }
      const today = new Date(); today.setHours(0,0,0,0);
      const upcoming = (all||[])
        .filter(e => e.published !== false)
        .filter(e => { const d = new Date(e.date+'T00:00:00'); return !isNaN(d) && d >= today; })
        .sort((a,b)=> (a.date||'').localeCompare(b.date||''));
      if(upcoming.length === 0){
        container.innerHTML = '<p class="text-dark">No upcoming events at the moment. Please check back later.</p>';
        return;
      }
      container.innerHTML = upcoming.map((e,i)=>cardHtml(e, 0.1 + i*0.2)).join('');
      if (window.WOW) new WOW().init();
    }catch(err){
  console.warn('Events failed to load:', err);
      container.innerHTML = '<p class="text-dark">Events are unavailable right now.</p>';
    }
  }
  document.addEventListener('DOMContentLoaded', load);
})();
