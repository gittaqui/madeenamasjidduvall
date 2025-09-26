(function(){
  const widget = document.getElementById('subscribe-widget');
  if(!widget) return;
  const form = document.getElementById('subscribe-form');
  const msg = document.getElementById('subscribe-msg');
  const closeBtn = document.getElementById('subscribe-close');
  closeBtn?.addEventListener('click', ()=> widget.remove());
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    msg.textContent = 'Sending...';
    const fd = new FormData(form);
    const email = fd.get('email');
    const website = fd.get('website');
    try {
      const res = await fetch('/api/subscribe', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, website }) });
      const data = await res.json().catch(()=>({}));
      if(!res.ok || !data.ok){ throw new Error(data.error||'Failed'); }
      msg.textContent = data.status === 'already-active' ? 'Already subscribed.' : 'Check your email to confirm.';
      form.reset();
    } catch(err){
      console.error(err);
      msg.textContent = 'Error: ' + err.message;
    }
  });
})();