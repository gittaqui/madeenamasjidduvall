// Lightweight auth widget for Azure Static Web Apps
// Supports Microsoft (AAD) and Google providers. First sign-in acts as registration.
(function(){
  const BOX_ID = 'auth-box';
  const STORAGE_KEY = 'swaAuthPrincipal';
  function qs(id){ return document.getElementById(id); }
  function loginUrl(provider){
    const ret = encodeURIComponent(location.pathname + location.search + location.hash);
    return `/.auth/login/${provider}?post_login_redirect_uri=${ret}`;
  }
  function logoutUrl(){
    const ret = encodeURIComponent(location.pathname + location.search + location.hash);
    return `/.auth/logout?post_logout_redirect_uri=${ret}`;
  }
  function renderLoading(){ const b=qs(BOX_ID); if(b) b.innerHTML='<span class="text-secondary small">Auth…</span>'; }
  function renderSignedOut(){
    const b=qs(BOX_ID); if(!b) return;
    b.innerHTML = `
      <div class="d-flex flex-wrap align-items-center gap-2">
        <span class="text-secondary small">Sign in:</span>
        <a class="btn btn-sm btn-outline-primary" href="${loginUrl('aad')}" title="Sign in with Microsoft (Entra ID)">Microsoft</a>
        <a class="btn btn-sm btn-outline-primary" href="${loginUrl('github')}" title="Sign in with GitHub">GitHub</a>
        <!-- To enable Google later: configure Google provider in Azure Portal (Authentication > switch to Custom > Add identity provider) then re-add a Google button pointing to /.auth/login/google -->
      </div>`;
  }
  function renderSignedIn(principal){
  const roles = principal.userRoles || [];
  const rawDetails = principal.userDetails || principal.identityProvider || 'User';
  const first = firstNameOf(rawDetails);
  const name = first && first.toLowerCase() !== rawDetails.toLowerCase() ? `${first} (${rawDetails})` : first;
    const b=qs(BOX_ID); if(!b) return;
    const isAdmin = roles.includes('admin');
    b.innerHTML = `
      <div class="d-flex flex-wrap align-items-center gap-2">
        <span class="small text-secondary">Hi, ${escapeHtml(name)}${isAdmin ? ' <span class=\"badge bg-primary\">admin</span>' : ''}</span>
        ${isAdmin ? '<a class="btn btn-sm btn-outline-success" href="/admin-schedule.html" title="Admin schedule editor">Admin</a>' : ''}
        <a class="btn btn-sm btn-outline-secondary" href="${logoutUrl()}" title="Sign out">Sign out</a>
      </div>`;
  }
  function escapeHtml(s){ return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]||c)); }
  function firstNameOf(details){
    if(!details) return 'User';
    // If email, take part before @, otherwise first token
    let raw = details.includes('@') ? details.split('@')[0] : details.split(/\s+/)[0];
    raw = raw.replace(/[^A-Za-z0-9_-]/g,' ').trim();
    if(!raw) return 'User';
    return raw.charAt(0).toUpperCase()+raw.slice(1);
  }
  function loadCached(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return false;
      const cached = JSON.parse(raw);
      if(cached && cached.userDetails){
        renderSignedIn(cached);
        return true;
      }
    }catch{}
    return false;
  }
  async function load(){
    // Optimistic render from cache (avoids flicker on navigation)
    const hadCache = loadCached();
    if(!hadCache) renderLoading();
    try{
      const resp = await fetch('/.auth/me',{cache:'no-store'});
      if(!resp.ok){ renderSignedOut(); return; }
      const info = await resp.json(); // shape: {clientPrincipal:{identityProvider,userDetails,userRoles,claims:[]}}
      let principal = info && (info.clientPrincipal || info.principal || info);
      // If userDetails empty, attempt to extract from email/upn/name claim
      if(principal && (!principal.userDetails || principal.userDetails.trim()==='')){
        if(Array.isArray(principal.claims)){
          const findClaim = (typArr)=> principal.claims.find(c=> typArr.includes(c.typ || c.type));
          const emailClaim = findClaim(['email','emails']);
          const upnClaim = findClaim(['upn']);
          const nameClaim = findClaim(['name']);
            principal.userDetails = (emailClaim && emailClaim.val) || (upnClaim && upnClaim.val) || (nameClaim && nameClaim.val) || principal.userDetails;
        }
      }
      if(principal && principal.userDetails){
        renderSignedIn(principal);
        try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(principal)); }catch{}
      } else {
        renderSignedOut();
        try{ localStorage.removeItem(STORAGE_KEY); }catch{}
      }
    }catch{ renderSignedOut(); }
  }
  window.addEventListener('storage', (e)=>{
    if(e.key === STORAGE_KEY){
      try{ const v = e.newValue && JSON.parse(e.newValue); if(v) renderSignedIn(v); else renderSignedOut(); }catch{}
    }
  });
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', load); else load();
})();