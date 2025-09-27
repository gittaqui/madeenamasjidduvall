(function(){
  const API_BASE = (window.RSVP_API_BASE || window.API_BASE || '/api').replace(/\/$/,'');
  const form = document.getElementById('footer-subscribe-form');
  const msgEl = document.getElementById('footer-subscribe-msg');
  if(!form || !msgEl) return;
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