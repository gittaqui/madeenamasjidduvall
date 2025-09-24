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

    // Flash banner feature
    try {
      const enabled = !!(features && features.flashBanner);
      const text = (announcements && announcements.flashText) || '';
      const banner = document.getElementById('flash-banner');
      const txt = document.getElementById('flash-text');
      const closeBtn = document.getElementById('flash-close');
      if (banner && txt && closeBtn) {
        if (enabled && text) {
          txt.textContent = text;
          banner.classList.remove('d-none');
        } else {
          banner.classList.add('d-none');
        }
      }
    } catch { /* ignore */ }
  }

  (async function init() {
    const cfg = await loadConfig();
    applyConfig(cfg);
  })();
})();
