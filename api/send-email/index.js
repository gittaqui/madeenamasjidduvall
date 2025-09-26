let nodemailer; // loaded lazily only if SMTP is used
let nodeFetch; // loaded lazily only if proxy is needed
let HttpsProxyAgent; // loaded lazily only if proxy is needed
const https = require('https');
const dns = require('dns');

// Simple in-memory rate limiting (per function instance). Suitable for light protection; not distributed.
// Environment variables:
// RATE_LIMIT_WINDOW_MS (default 60000), RATE_LIMIT_MAX (default 5), RATE_LIMIT_DISABLE=1 to turn off
const rateState = new Map(); // key => { count, firstTs }

function checkRateLimit(key) {
  const disable = String(process.env.RATE_LIMIT_DISABLE || '').toLowerCase() === '1';
  if (disable) return null;
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);
  const max = Number(process.env.RATE_LIMIT_MAX || 5);
  const now = Date.now();
  let entry = rateState.get(key);
  if (!entry || (now - entry.firstTs) > windowMs) {
    entry = { count: 0, firstTs: now };
  }
  entry.count++;
  rateState.set(key, entry);
  if (entry.count > max) {
    const retryAfterSec = Math.ceil((entry.firstTs + windowMs - now) / 1000);
    return { retryAfterSec, max };
  }
  return null;
}

module.exports = async function (context, req) {
  try {
    const body = req.body || {};
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  let subject = String(body.subject || '').trim(); // let so we can tag for spam
  const message = String(body.message || '').trim();
  const debugFlag = (req.query && req.query.debug) || body.debug;
    const hp = String(body.hp || '').trim(); // honeypot

    // Basic validation & limits
    if (hp) {
      context.res = { status: 200, body: { ok: true } }; // silently ok on bots
      return;
    }
    if (!name || !email || !subject || !message) {
      context.res = { status: 400, body: { error: 'Missing required fields' } };
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      context.res = { status: 400, body: { error: 'Invalid email' } };
      return;
    }

    const maxName = Number(process.env.MAX_NAME_LENGTH || 100);
    const maxSubject = Number(process.env.MAX_SUBJECT_LENGTH || 200);
    const maxMessage = Number(process.env.MAX_MESSAGE_LENGTH || 5000);
    if (name.length > maxName) {
      context.res = { status: 400, body: { error: `Name too long (max ${maxName} chars)` } }; return;
    }
    if (subject.length > maxSubject) {
      context.res = { status: 400, body: { error: `Subject too long (max ${maxSubject} chars)` } }; return;
    }
    if (message.length > maxMessage) {
      context.res = { status: 400, body: { error: `Message too long (max ${maxMessage} chars)` } }; return;
    }

    // Rate limit (per IP + coarse email uniqueness) to deter bursts
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.headers['x-client-ip'] || req.headers['x-real-ip'] || (req.connection && req.connection.remoteAddress) || 'unknown';
    const rateKey = ip + '|' + (email || '');
    const rateResult = checkRateLimit(rateKey);
    if (rateResult) {
      context.res = { status: 429, headers: { 'Retry-After': String(rateResult.retryAfterSec) }, body: { error: 'Rate limit exceeded', retryAfterSeconds: rateResult.retryAfterSec, limit: rateResult.max } };
      return;
    }

  // Support multiple recipients via comma/semicolon separated list
  const rawToBase = process.env.TO_EMAIL || process.env.CONTACT_TO_EMAIL || '';
  const forceToRaw = process.env.FORCE_TO_EMAIL || '';
  const rawTo = forceToRaw || rawToBase;
  let toList = rawTo.split(/[;,]/).map(s => s && s.trim()).filter(Boolean);
  const toEmail = toList[0]; // preserve original single-to variable usage
  const forceFrom = process.env.FORCE_FROM_EMAIL;
  const fromEmail = forceFrom || process.env.FROM_EMAIL || process.env.CONTACT_FROM_EMAIL || toEmail;
  const provider = String(process.env.MAIL_PROVIDER || '').toLowerCase();

    // --- Lightweight spam scoring ---
    function scoreSpam(subjectVal, messageVal){
      let score = 0; const reasons = [];
      const msgLower = messageVal.toLowerCase();
      const subjLower = subjectVal.toLowerCase();
      const urlMatches = messageVal.match(/https?:\/\//gi) || [];
      if(urlMatches.length){ score += urlMatches.length * 2; reasons.push(`urls:${urlMatches.length}`); }
      const longMsg = messageVal.length;
      if(longMsg > 2000){ score += 2; reasons.push('len>2000'); }
      if(longMsg > 4000){ score += 3; reasons.push('len>4000'); }
      const exclam = (messageVal.match(/!/g)||[]).length;
      if(exclam > 10){ score += 2; reasons.push('exclam>10'); }
      if(/viagra|casino|free money|bitcoin|crypto wallet|click here|winner|loan approval|100% free/i.test(msgLower)){ score += 5; reasons.push('keywords'); }
      if(/^[A-Z0-9 \-!?]{8,}$/.test(subjectVal) && /[A-Z]/.test(subjectVal) && !/[a-z]/.test(subjectVal)){ score += 2; reasons.push('caps-subject'); }
      const emailCount = (messageVal.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig)||[]).length;
      if(emailCount > 3){ score += 2; reasons.push('many-emails'); }
      const repeatSeq = /(.)\1{9,}/; // 10 identical consecutive chars
      if(repeatSeq.test(messageVal)){ score += 2; reasons.push('repeat-chars'); }
      return { score, reasons };
    }
    const spamReject = Number(process.env.SPAM_REJECT_THRESHOLD || 20);
    const spamTag = Number(process.env.SPAM_TAG_THRESHOLD || 10);
    const { score: spamScore, reasons: spamReasons } = scoreSpam(subject, message);
    let spamTagged = false;
    if (spamScore >= spamReject) {
      context.res = { status: 400, body: { error: 'Rejected as spam', spamScore, reasons: spamReasons } };
      return;
    }
    if (spamScore >= spamTag) {
      subject = `[Possible Spam] ${subject}`;
      spamTagged = true;
    }

    const html = `
      <h2>New contact message</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
      <p><strong>Message:</strong><br/>${escapeHtml(message).replace(/\n/g,'<br/>')}</p>
      <p><em>SpamScore: ${spamScore}${spamReasons.length ? ' ('+spamReasons.map(r=>escapeHtml(r)).join(', ')+')' : ''}</em></p>
    `;
    const text = `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\nSpamScore: ${spamScore}${spamReasons.length? ' ('+spamReasons.join(', ')+')':''}\n\n${message}`;

    const customHeaders = {
      'X-Contact-SpamScore': String(spamScore),
      'X-Contact-SpamReasons': spamReasons.join(',') || 'none'
    };

  // Choose provider: explicit MAIL_PROVIDER wins; otherwise auto-detect by available env vars
  const hasSmtp = !!process.env.SMTP_HOST;
  const hasGraph = !!(process.env.GRAPH_TENANT_ID && process.env.GRAPH_CLIENT_ID && process.env.GRAPH_CLIENT_SECRET && (process.env.GRAPH_SENDER_UPN || process.env.GRAPH_SENDER_ID));
  const hasResend = !!process.env.RESEND_API_KEY;

  async function sendViaSmtp() {
      if (!nodemailer) nodemailer = require('nodemailer');
      const host = process.env.SMTP_HOST;
      const port = Number(process.env.SMTP_PORT || 587);
      const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;
      const devTest = String(process.env.DEV_SMTP_TEST || '').toLowerCase() === '1';
      if ((!host || host === 'ethereal' || !user || !pass) && devTest) {
        const testAccount = await nodemailer.createTestAccount();
        const etherealTransport = nodemailer.createTransport({
          host: testAccount.smtp.host,
          port: testAccount.smtp.port,
          secure: testAccount.smtp.secure,
          auth: { user: testAccount.user, pass: testAccount.pass }
        });
  const info = await etherealTransport.sendMail({ from: fromEmail || 'no-reply@example.com', to: toEmail || testAccount.user, subject: `[Contact] ${subject}`, text, html, replyTo: email, headers: customHeaders });
        // Expose preview URL in response for local testing
        context.res = { status: 200, body: { ok: true, previewUrl: nodemailer.getTestMessageUrl(info) } };
        return;
      }
      if (!host || !toEmail || !fromEmail) throw new Error('SMTP not configured');
      const transporter = nodemailer.createTransport({ host, port, secure, auth: user && pass ? { user, pass } : undefined });
      try {
  await transporter.sendMail({ from: fromEmail, to: toList.length ? toList.join(',') : toEmail, subject: `[Contact] ${subject}`, text, html, replyTo: email, headers: customHeaders });
      } catch (smtpErr) {
        const msg = String(smtpErr && (smtpErr.response || smtpErr.message) || smtpErr);
        if (/\b450\b/i.test(msg) && /verify( a)? domain/i.test(msg)) {
          throw new Error('Resend SMTP blocked: domain not verified. Add and verify your domain in Resend dashboard (SPF + DKIM), then use a From address at that domain (e.g. noreply@yourdomain.com).');
        }
        throw smtpErr;
      }
    }

  async function sendViaGraph() {
      if (!hasGraph) throw new Error('Graph not configured');
      const tenantId = process.env.GRAPH_TENANT_ID;
      const clientId = process.env.GRAPH_CLIENT_ID;
      const clientSecret = process.env.GRAPH_CLIENT_SECRET;
      const sender = process.env.GRAPH_SENDER_UPN || process.env.GRAPH_SENDER_ID; // UPN/email or user id
      const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;

      const params = new URLSearchParams();
      params.append('client_id', clientId);
      params.append('client_secret', clientSecret);
      params.append('grant_type', 'client_credentials');
      params.append('scope', 'https://graph.microsoft.com/.default');

      const tokenResp = await fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
      if (!tokenResp.ok) {
        const txt = await tokenResp.text().catch(() => '');
        throw new Error(`Graph token error: ${tokenResp.status} ${tokenResp.statusText} ${txt}`.trim());
      }
      const tokenJson = await tokenResp.json();
      const accessToken = tokenJson.access_token;
      if (!accessToken) throw new Error('Graph token missing access_token');

      const sendUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`;
      const payload = {
        message: {
          subject: `[Contact] ${subject}`,
          body: { contentType: 'HTML', content: html },
          toRecipients: (toList.length ? toList : [toEmail]).map(addr => ({ emailAddress: { address: addr } })),
          replyTo: email ? [{ emailAddress: { address: email } }] : undefined,
          from: fromEmail ? { emailAddress: { address: fromEmail } } : undefined,
          internetMessageHeaders: Object.entries(customHeaders).map(([k,v])=>({ name:k, value:v }))
        },
        saveToSentItems: false
      };
  const resp = await fetch(sendUrl, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        throw new Error(`Graph sendMail error: ${resp.status} ${resp.statusText} ${errText}`.trim());
      }
    }

    async function sendViaResend() {
      if (!hasResend) throw new Error('Resend not configured');
      // Optional: allow insecure TLS for local debugging only
      if (String(process.env.DEV_INSECURE_TLS || '').toLowerCase() === '1') {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      }
      const apiKey = process.env.RESEND_API_KEY;
      const from = fromEmail || 'noreply@madeenamasjid.com';
  const payload = { from, to: toList.length ? toList : [toEmail], subject: `[Contact] ${subject}`, html, text, reply_to: email, headers: customHeaders };
      // Optional timeout (ms) for connect/read to avoid hanging in restricted networks
  const timeoutMs = Number(process.env.RESEND_TIMEOUT_MS || 45000);
  const maxRetries = Number(process.env.RESEND_RETRIES || 1); // additional attempts after first
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(new Error('client-timeout')), timeoutMs);
      // Optional proxy support via env: HTTPS_PROXY or HTTP_PROXY
      const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.PROXY_URL;
      try {
        let resp;
        let attempt = 0;
        let lastErr;
        const useProxy = !!proxyUrl;
        const ipv4Lookup = (hostname, options, cb) => {
          dns.lookup(hostname, { all: true }, (err, addrs) => {
            if (err) return cb(err);
            const v4 = addrs.find(a => a.family === 4) || addrs[0];
            cb(null, v4.address, v4.family);
          });
        };
        const doRequest = async (forceIpv4) => {
          attempt++;
          if (useProxy) {
          // Lazy-load only when needed
          if (!nodeFetch) nodeFetch = require('node-fetch');
          if (!HttpsProxyAgent) ({ HttpsProxyAgent } = require('https-proxy-agent'));
          const agent = new HttpsProxyAgent(proxyUrl);
            return nodeFetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            agent,
            signal: controller.signal
          });
          } else if (forceIpv4) {
            if (!nodeFetch) nodeFetch = require('node-fetch');
            const agent = new https.Agent({ lookup: ipv4Lookup });
            return nodeFetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              agent,
              signal: controller.signal
            });
          } else {
            return fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
          });
          }
        };

        while (attempt <= (1 + maxRetries)) {
          try {
            resp = await doRequest(attempt > 1); // on retry force IPv4 path
            break;
          } catch (e) {
            lastErr = e;
            const msg = String(e && e.message || e);
            const isTimeout = /client-timeout|UND_ERR_CONNECT_TIMEOUT|TimeoutError|timed out/i.test(msg);
            if (attempt <= (1 + maxRetries) && isTimeout) {
              // retry
              continue;
            }
            throw e;
          }
        }
        clearTimeout(t);
        if (!resp.ok) {
          const errText = await resp.text().catch(() => '');
          throw new Error(`Resend error: ${resp.status} ${resp.statusText} ${errText}`.trim());
        }
      } catch (err) {
        clearTimeout(t);
        // Provide detailed diagnostics to help troubleshoot local DNS/TLS/Proxy issues
        const parts = [];
        parts.push(`message=${JSON.stringify((err && err.message) || String(err))}`);
        if (err && (err.code || err.errno || err.type)) {
          if (err.code) parts.push(`code=${err.code}`);
          if (err.errno) parts.push(`errno=${err.errno}`);
          if (err.type) parts.push(`type=${err.type}`);
        }
        if (err && err.cause) {
          try {
            const c = err.cause;
            const cParts = [];
            if (c.code) cParts.push(`code=${c.code}`);
            if (c.errno) cParts.push(`errno=${c.errno}`);
            if (c.address) cParts.push(`address=${c.address}`);
            if (c.port) cParts.push(`port=${c.port}`);
            if (c.reason) cParts.push(`reason=${JSON.stringify(c.reason)}`);
            parts.push(`cause={${cParts.join(', ')}}`);
          } catch {}
        }
        // Include a hint when TLS verification is likely the issue
        const hint = ' HINT: If this is a TLS error (e.g., SELF_SIGNED_CERT_IN_CHAIN, UNABLE_TO_VERIFY_LEAF_SIGNATURE), set DEV_INSECURE_TLS=1 in local.settings.json to test locally, or configure your corporate proxy/cert trust store. If behind a corporate proxy, set HTTPS_PROXY to your proxy URL and restart the Functions host.';
        throw new Error(`Resend fetch failed: ${parts.join(' ')}${hint}`);
      }
    }

    if (!toEmail) {
      context.res = { status: 501, body: { error: 'Email service not configured', setup: 'Set TO_EMAIL and SMTP_* envs.' } };
      return;
    }

    if (String(process.env.DEV_VERBOSE||'').toLowerCase()==='1') {
  const redact = String(process.env.REDACT_LOGS||'').toLowerCase()==='1';
  context.log('[send-email] provider=%s from=%s to=%s (list=%j) spamScore=%d tagged=%s reasons=%j forceTo=%s rawFromEnv=%s forceFrom=%s', provider, fromEmail, toEmail, toList, spamScore, spamTagged, spamReasons, forceToRaw || '', process.env.FROM_EMAIL || '', forceFrom || '');
  if(!redact){
    context.log('[send-email] subject="%s" msgLength=%d', subject, message.length);
  }
    }

    // If debug=1 provided, return the effective configuration without sending
    if (String(debugFlag) === '1') {
      context.res = { status: 200, body: {
        debug: true,
        provider,
        fromEmail,
        toList,
        hasSmtp, hasResend, hasGraph,
        envSample: {
          MAIL_PROVIDER: process.env.MAIL_PROVIDER,
          TO_EMAIL: process.env.TO_EMAIL,
          CONTACT_TO_EMAIL: process.env.CONTACT_TO_EMAIL,
          FROM_EMAIL: process.env.FROM_EMAIL
        }
      }};
      return;
    }

    // Dispatch by provider
    try {
      // Domain verification guard: block external sends if using onboarding sender
      const fromDomain = (fromEmail.split('@')[1] || '').toLowerCase();
      const externalTargets = toList.filter(addr => !/resend\.dev$/i.test(addr.split('@')[1]||''));
      const usingOnboarding = /resend\.dev$/i.test(fromDomain);
      if (usingOnboarding && externalTargets.length) {
        context.res = { status: 400, body: { error: 'Unverified sending domain', reason: 'You are using the onboarding@resend.dev (or another resend.dev) sender. To send to external recipients (e.g. '+externalTargets[0]+'), verify your domain in the Resend dashboard and set FROM_EMAIL to an address at that domain (e.g. noreply@madeenamasjid.com).' } };
        return;
      }
      if (provider === 'graph') {
        await sendViaGraph();
      } else if (provider === 'resend') {
        await sendViaResend();
      } else if (provider === 'smtp') {
        await sendViaSmtp();
      } else if (hasSmtp) {
        await sendViaSmtp();
      } else if (hasResend) {
        await sendViaResend();
      } else if (hasGraph) {
        await sendViaGraph();
      } else {
        context.res = { status: 501, body: { error: 'Email service not configured', setup: 'Provide SMTP_* or Graph envs: GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET, GRAPH_SENDER_UPN.' } };
        return;
      }
    } catch (sendErr) {
      // If SMTP failed due to basic auth disabled, fallback to Graph when available
      const msg = String(sendErr && sendErr.message || sendErr);
      const looksLikeBasicDisabled = /5\.7\.139|basic authentication is disabled|Client not authenticated to send mail/i.test(msg);
      if ((provider === 'smtp' || !provider) && looksLikeBasicDisabled && hasGraph) {
        await sendViaGraph();
      } else if ((provider === 'smtp' || !provider) && looksLikeBasicDisabled && hasResend) {
        await sendViaResend();
      } else {
        throw sendErr;
      }
    }

    context.res = { status: 200, body: { ok: true } };
  } catch (e) {
    context.log('send-email error', e);
    const verbose = String(process.env.DEV_VERBOSE || '').toLowerCase() === '1' || String(process.env.NODE_ENV).toLowerCase() !== 'production';
    context.res = { status: 500, body: verbose ? { error: 'Failed to send email', reason: String(e && e.message || e) } : { error: 'Failed to send email' } };
  }
};

function escapeHtml(str){
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

// No external fetch helpers needed after removing Resend
