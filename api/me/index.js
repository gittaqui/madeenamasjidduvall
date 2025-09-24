module.exports = async function (context, req) {
  try {
    const header = req.headers['x-ms-client-principal'];
    let principal = null;
    let decodeError = null;
    if (header) {
      try {
        principal = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
      } catch (e) {
        decodeError = e.message;
        context.log('Failed to decode principal header', e);
      }
    }
    context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: { ok: true, hasHeader: !!header, decodeError, principal, envBypass: process.env.DEV_ALLOW_NON_ADMIN === '1' } };
  } catch (err) {
    context.log('Unexpected /api/me error', err);
    context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { ok: false, error: err.message, stack: err.stack } };
  }
};