// Helper to extract roles from Azure Static Web Apps client principal header
function getClientPrincipal(req){
  try {
    const header = req.headers['x-ms-client-principal'];
    if(!header) return null;
    const decoded = Buffer.from(header, 'base64').toString('utf8');
    const obj = JSON.parse(decoded);
    return obj;
  } catch { return null; }
}

function hasRole(req, role){
  const cp = getClientPrincipal(req);
  if(!cp || !Array.isArray(cp.userRoles)) return false;
  return cp.userRoles.includes(role);
}

module.exports = { getClientPrincipal, hasRole };
