// Home page Next Event teaser
(function(){
  const CONFIG_URL = 'site-config.json';
  const EVENTS_JSON_FALLBACK = 'events.json';
  function fmtDate(iso){
    try{
      const d = new Date(iso+'T00:00:00');
      return d.toLocaleDateString(undefined,{ day:'2-digit', month:'short', year:'numeric'});
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
  function render(ev){
    const container = document.getElementById('home-next-event');
    if(!container) return;
    if(!ev){
      container.innerHTML = '<p class="text-dark">No upcoming events at the moment.</p>';
      return;
    }
    const dateStr = fmtDate(ev.date);
    const whenStr = weekdayAndTime(ev.date, ev.time);
    const img = ev.image || 'img/events-1.jpg';
  // CTA removed per request (no More Info / Sign Up button)
    container.innerHTML = `
      <div class="row g-4 event-item wow fadeIn" data-wow-delay="0.1s">
        <div class="col-12 col-lg-8">
          <div class="d-flex align-items-center">
            <div class="text-center me-3" style="min-width:120px">
              <div class="border-bottom border-dark py-3 px-2">
                <h6 class="mb-1">${dateStr}</h6>
                <p class="mb-0">${whenStr}</p>
              </div>
            </div>
            <div>
              <h4 class="mb-1">${ev.title}</h4>
              <p class="mb-0">${ev.description || ''}</p>
            </div>
          </div>
        </div>
        <div class="col-12 col-lg-4">
          <img src="${img}" class="img-fluid rounded" alt="">
        </div>
      </div>`;
    if (window.WOW) new WOW().init();
  }
  async function load(){
    const el = document.getElementById('home-next-event');
    if(!el) return;
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
        if(resp.ok) all = await resp.json();
      }
      const today = new Date(); today.setHours(0,0,0,0);
      const upcoming = (all||[])
        .filter(e => e.published !== false)
        .filter(e => { const d = new Date(e.date+'T00:00:00'); return !isNaN(d) && d >= today; })
        .sort((a,b)=> (a.date||'').localeCompare(b.date||''));
      render(upcoming[0]);
    }catch(err){
      console.warn('Next event failed to load:', err);
      render(null);
    }
  }
  document.addEventListener('DOMContentLoaded', load);
})();
