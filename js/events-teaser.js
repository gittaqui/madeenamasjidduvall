// Home page Next Event teaser
(function(){
  const EVENTS_URL = 'events.json';
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
    const ctaText = ev.ctaText || 'Details';
    const ctaUrl = ev.ctaUrl || 'event.html';
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
              <h4 class="mb-2">${ev.title}</h4>
              <p class="mb-3">${ev.description || ''}</p>
              <a href="${ctaUrl}" class="btn btn-primary btn-sm">${ctaText}</a>
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
      const resp = await fetch(EVENTS_URL, { cache: 'no-store' });
      if(!resp.ok) throw new Error('Failed to load events');
      const all = await resp.json();
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
