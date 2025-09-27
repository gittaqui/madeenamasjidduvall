(function(){
  const API_BASE = (window.RSVP_API_BASE || window.API_BASE || '/api').replace(/\/$/,'');
  let form = document.getElementById('footer-subscribe-form');
  let msgEl = document.getElementById('footer-subscribe-msg');
  // Auto-inject minimal footer subscribe form on pages that lack the index.html footer markup
  if(!form){
    const footer = document.querySelector('.footer .container') || document.querySelector('.footer');
    if(footer){
      const wrap = document.createElement('div');
      wrap.className = 'mb-4';
      wrap.innerHTML = `
        <form id="footer-subscribe-form" class="position-relative mx-auto" style="max-width:480px" novalidate>
          <input id="footer-subscribe-email" class="form-control border-0 w-100 py-2 ps-3 pe-5" name="email" type="email" autocomplete="email" placeholder="Your email" required aria-label="Email address for newsletter" />
          <input type="text" name="website" class="d-none" tabindex="-1" autocomplete="off" aria-hidden="true" />
          <button type="submit" class="btn btn-primary py-1 position-absolute top-0 end-0 mt-1 me-1" id="footer-subscribe-btn">Subscribe</button>
          <div id="footer-subscribe-msg" class="small position-absolute start-0 w-100" style="top:100%;"></div>
        </form>`;
      footer.appendChild(wrap);
      form = wrap.querySelector('#footer-subscribe-form');
      msgEl = wrap.querySelector('#footer-subscribe-msg');
    }
  }
  if(!form || !msgEl) return; // give up silently if still missing
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    msgEl.textContent = 'Sending...';
    const fd = new FormData(form);
    const email = (fd.get('email')||'').trim();
    const website = (fd.get('website')||'').trim();
    if(!email){ msgEl.textContent='Enter an email.'; return; }
    try {
  const res = await fetch(`${API_BASE}/subscribe`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, website }) });
      const data = await res.json().catch(()=>({}));
      if(!res.ok || !data.ok) throw new Error(data.error||'Failed');
      msgEl.textContent = data.status === 'already-active' ? 'Already subscribed.' : 'Check your email to confirm.';
      form.reset();
    } catch(err){ msgEl.textContent = 'Error: '+ err.message; }
  });
})();