// Lightweight auth widget for Azure Static Web Apps
// Supports Microsoft (AAD) and Google providers. First sign-in acts as registration.
(function(){
  const BOX_ID = 'auth-box';
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
    const name = principal.userDetails || principal.identityProvider || 'User';
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
  async function load(){
    renderLoading();
    try{
      const resp = await fetch('/.auth/me',{cache:'no-store'});
      if(!resp.ok){ renderSignedOut(); return; }
      const info = await resp.json();
      if(info && info.clientPrincipal){
        renderSignedIn(info.clientPrincipal);
      } else {
        renderSignedOut();
      }
    }catch{ renderSignedOut(); }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', load); else load();
})();