// Loads site-config.json and applies contact & social settings across pages
(function () {
  async function loadConfig() {
    const tryFetch = async (url) => {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to load ${url}`);
      return await res.json();
    };
    try {
      // Prefer absolute from site root
      return await tryFetch('/site-config.json');
    } catch (e1) {
      try {
        // Fallback to relative path (helps when opened via file:// or nested routes)
        return await tryFetch('site-config.json');
      } catch (e2) {
        console.warn('site-config.json not found or failed to load:', e1, e2);
        return null;
      }
    }
  }

  function setText(el, text) {
    if (!el) return;
    if (el.tagName === 'A') {
      // keep link text inside span when exists
      const span = el.querySelector('span');
      if (span) span.textContent = text;
      else el.textContent = text;
    } else {
      el.textContent = text;
    }
  }

  function ensureHref(el, href) {
    if (!el || !href) return;
    el.setAttribute('href', href);
  }

  function updateSocial(container, socials) {
    if (!container) return;
    const map = {
      'fa-facebook-f': socials.facebook,
      'fa-facebook': socials.facebook,
      'fa-twitter': socials.twitter,
      'fa-linkedin-in': socials.linkedin,
      'fa-linkedin': socials.linkedin,
      'fa-instagram': socials.instagram
    };
    container.querySelectorAll('a').forEach(a => {
      const icon = a.querySelector('i');
      if (!icon) return;
      for (const cls of Object.keys(map)) {
        if (icon.classList.contains(cls)) {
          if (map[cls]) {
            ensureHref(a, map[cls]);
            a.setAttribute('rel', 'noopener noreferrer');
            a.setAttribute('target', '_blank');
          } else {
            a.style.display = 'none';
          }
          break;
        }
      }
    });
  }

  function applyConfig(cfg) {
    if (!cfg) return;
    const { contact, social, features, announcements } = cfg;

    // Topbar phone/email
    try {
      const phoneWrap = document.querySelector('.topbar .fa-phone-alt')?.closest('div');
      const phoneLink = phoneWrap ? phoneWrap.querySelector('a') : null;
      if (contact?.phone) {
        setText(phoneLink, contact.phone);
        ensureHref(phoneLink, `tel:${contact.phone.replace(/[^+\d]/g, '')}`);
      }
      const emailWrap = document.querySelector('.topbar .fa-envelope')?.closest('div');
      const emailLink = emailWrap ? emailWrap.querySelector('a') : null;
      if (contact?.email) {
        setText(emailLink, contact.email);
        ensureHref(emailLink, `mailto:${contact.email}`);
      }
    } catch { /* ignore */ }

    // Footer address and phone
    try {
      const footer = document.querySelector('.footer');
      const addrRow = document.querySelector('.footer .fa-map-marker-alt')?.closest('.d-flex');
      const addrLink = addrRow ? addrRow.querySelector('a, .text-body') : null;
      if (contact?.address && addrLink) setText(addrLink, contact.address);

      const phoneRow = document.querySelector('.footer .fa-phone-alt')?.closest('.d-flex');
      const phoneLink2 = phoneRow ? phoneRow.querySelector('a, .text-body') : null;
      if (contact?.phone && phoneLink2) {
        setText(phoneLink2, contact.phone);
        if (phoneLink2.tagName === 'A') ensureHref(phoneLink2, `tel:${contact.phone.replace(/[^+\d]/g, '')}`);
      }
    } catch { /* ignore */ }

    // Socials: topbar and any social button groups on pages
    try {
      document.querySelectorAll('.topbar-inner, .footer, .about .btn-primary, .team, .testimonial, header, .navbar').forEach(section => {
        updateSocial(section, social || {});
      });
    } catch { /* ignore */ }

    // Flash banner feature with optional rotation
    try {
      const enabled = !!(features && features.flashBanner);
      const banner = document.getElementById('flash-banner');
      const txt = document.getElementById('flash-text');
      if(!(banner && txt && enabled)) return;
      // Build messages array (new format) or fallback to single-legacy fields
      let messages = Array.isArray(announcements?.messages) ? announcements.messages.slice() : [];
      if(!messages.length){
        const singleText = (announcements && (announcements.flashText || announcements.text)) || '';
        if(singleText){
          messages = [{
            text: singleText,
            subText: announcements?.subText || '',
            linkUrl: announcements?.linkUrl || '',
            style: announcements?.style || ''
          }];
        }
      }
      // Time window filtering (startUtc/endUtc in ISO)
      const now = Date.now();
      messages = messages.filter(m=>{
        const startOk = !m.startUtc || Date.parse(m.startUtc) <= now;
        const endOk = !m.endUtc || Date.parse(m.endUtc) >= now;
        return startOk && endOk && m.text;
      });
      if(!messages.length){ banner.classList.add('d-none'); return; }
      const intervalMs = Math.max(3000, (announcements?.rotateIntervalSeconds || 0) * 1000);
      let idx = 0;
      function render(msg, animate){
        txt.innerHTML = '';
        const mainSpan = document.createElement('span');
        mainSpan.textContent = msg.text;
        txt.appendChild(mainSpan);
        if(msg.subText){
          const sub = document.createElement('span');
          sub.className='ms-3 small fw-normal';
          sub.textContent = msg.subText; txt.appendChild(sub);
        }
        if(msg.linkUrl){
          const a = document.createElement('a'); a.href=msg.linkUrl; a.textContent='Learn more'; a.className='ms-3 text-light text-decoration-underline'; a.target='_blank'; a.rel='noopener'; txt.appendChild(a);
        }
        if(msg.style === 'important') banner.classList.add('flash-important'); else banner.classList.remove('flash-important');
        if(animate){
          txt.classList.remove('flash-fade-in');
          // force reflow
          void txt.offsetWidth;
          txt.classList.add('flash-fade-in');
        }
        banner.classList.remove('d-none');
      }
      render(messages[0], false);
      if(messages.length > 1 && intervalMs > 0){
        setInterval(()=>{
          idx = (idx + 1) % messages.length;
          render(messages[idx], true);
        }, intervalMs);
      }
    } catch { /* ignore */ }
  }

  (async function init() {
    const cfg = await loadConfig();
    applyConfig(cfg);
  })();
})();
