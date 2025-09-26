// Contact form logic (extracted) v2
(function(){
  const START_MARK='[contact-ext]';
  function log(){ try{ console.debug.apply(console, arguments);}catch{} }
  function warn(){ try{ console.warn.apply(console, arguments);}catch{} }
  function err(){ try{ console.error.apply(console, arguments);}catch{} }

  function init(){
    let btn = document.getElementById('c-send') || document.querySelector('button[data-contact-send]');
    if(!btn){
      btn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent||'').trim().toLowerCase()==='send message');
    }
    if(!btn){ warn(START_MARK,'button not found'); return; }
    if(btn.getAttribute('data-handler')){ log(START_MARK,'handler already present:', btn.getAttribute('data-handler')); return; }

    const nameEl = document.getElementById('c-name');
    const emailEl = document.getElementById('c-email');
    const subjectEl = document.getElementById('c-subject');
    const messageEl = document.getElementById('c-message');
    const hpEl = document.getElementById('c-hp');

    // Status element
    let status = document.getElementById('c-status');
    if(!status){
      status = document.createElement('div');
      status.id='c-status';
      status.className='mt-3 small text-muted';
      status.setAttribute('role','status');
      status.setAttribute('aria-live','polite');
      btn.parentNode.appendChild(status);
    }
    status.textContent = 'Ready to send message.';

    // Honeypot styling (safety)
    if(hpEl){
      hpEl.setAttribute('tabindex','-1');
      hpEl.setAttribute('autocomplete','off');
      hpEl.setAttribute('aria-hidden','true');
      hpEl.style.position='absolute';
      hpEl.style.left='-9999px';
    }

    // Spinner
    const spinner = document.createElement('span');
    spinner.className='ms-2 spinner-border spinner-border-sm align-middle';
    spinner.style.display='none';
    spinner.setAttribute('aria-hidden','true');
    btn.appendChild(spinner);

    function setStatus(msg, ok){
      status.textContent = msg;
      status.classList.toggle('text-success', !!ok);
      status.classList.toggle('text-danger', !ok);
    }
    function validateEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

    async function send(){
      log(START_MARK,'send invoked');
      if(btn.disabled) return;
      const name = (nameEl && nameEl.value || '').trim();
      const email = (emailEl && emailEl.value || '').trim();
      const subject = (subjectEl && subjectEl.value || '').trim();
      const message = (messageEl && messageEl.value || '').trim();
      const hp = (hpEl && hpEl.value || '').trim();
      if(!name || !email || !subject || !message){ setStatus('Please fill in all fields.', false); return; }
      if(!validateEmail(email)){ setStatus('Please enter a valid email.', false); return; }
      btn.disabled = true; const prev = btn.firstChild ? btn.firstChild.textContent : btn.textContent; if(btn.firstChild) btn.firstChild.textContent='Sending…'; else btn.textContent='Sending…'; spinner.style.display='inline-block';
      setStatus('Sending message…', true);
      try {
        const base = (location.protocol==='file:' ? 'http://localhost:7071' : '');
        const endpoint = base + '/api/send-email';
        log(START_MARK,'POST', endpoint);
        const res = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, email, subject, message, hp }) });
        const data = await res.json().catch(()=>({}));
        if(res.ok && data && data.ok){
          setStatus('Message sent. Thank you!', true);
          setTimeout(()=>{ if(nameEl) nameEl.value=''; if(emailEl) emailEl.value=''; if(subjectEl) subjectEl.value=''; if(messageEl) messageEl.value=''; setStatus('You can send another message.', true); }, 2000);
        } else if(res.status===400 && data && data.error==='Unverified sending domain') {
          setStatus('Email temporarily blocked until domain is verified.', false);
        } else if(res.status===429){
          setStatus('Too many attempts. Please wait a bit.', false);
        } else if(res.status===501){
          setStatus('Email service not configured.', false);
        } else {
          setStatus((data && (data.error || data.reason)) || 'Failed to send message.', false);
        }
      } catch(e){
        err(START_MARK,'fetch failed', e);
        setStatus('Network error sending message.', false);
      } finally {
        btn.disabled=false; if(btn.firstChild) btn.firstChild.textContent=prev; else btn.textContent=prev; spinner.style.display='none';
      }
    }

    btn.addEventListener('click', send);
    btn.setAttribute('data-handler','ext');
    window.__contactSend = send; // expose for console

    // Enter key support
    (btn.closest('form') || document).addEventListener('keydown', e => {
      if(e.key==='Enter'){
        if(e.target===messageEl && e.shiftKey) return; // allow newline with shift
        e.preventDefault();
        send();
      }
    });

    log(START_MARK,'initialized');
  }

  if(document.readyState==='complete' || document.readyState==='interactive') {
    try { init(); } catch(e){ err(START_MARK,'init error', e); }
  } else {
    document.addEventListener('DOMContentLoaded', () => { try { init(); } catch(e){ err(START_MARK,'init error', e); } });
  }
})();
