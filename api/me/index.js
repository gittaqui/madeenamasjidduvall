module.exports = async function (context, req) {
  // Echo decoded principal if present
  let principal = null;
  try {
    const b64 = req.headers['x-ms-client-principal'];
    if (b64) {
      principal = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    }
  } catch (e) {
    context.log('Failed to parse principal', e.message);
  }
  context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: { principal } };
};