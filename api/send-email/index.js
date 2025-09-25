let nodemailer; // loaded lazily only if SMTP is used

module.exports = async function (context, req) {
  try {
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    const subject = String(body.subject || '').trim();
    const message = String(body.message || '').trim();
    const hp = String(body.hp || '').trim(); // honeypot

    // Basic validation
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

    const toEmail = process.env.TO_EMAIL || process.env.CONTACT_TO_EMAIL;
    const fromEmail = process.env.FROM_EMAIL || process.env.CONTACT_FROM_EMAIL || toEmail;
    const provider = String(process.env.MAIL_PROVIDER || '').toLowerCase();

    const html = `
      <h2>New contact message</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
      <p><strong>Message:</strong><br/>${escapeHtml(message).replace(/\n/g,'<br/>')}</p>
    `;
    const text = `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\n\n${message}`;

    // Choose provider: explicit MAIL_PROVIDER wins; otherwise auto-detect by available env vars
  const hasResend = !!process.env.RESEND_API_KEY;
  const hasSmtp = !!process.env.SMTP_HOST;

    async function sendViaResend() {
      const key = process.env.RESEND_API_KEY;
      if (!key || !toEmail || !fromEmail) throw new Error('Resend not configured');
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [toEmail],
          subject: `[Contact] ${subject}`,
          html,
          text,
          reply_to: email
        })
      });
      if (!res.ok) {
        const body = await safeReadJson(res);
        throw new Error(`Resend error ${res.status}: ${JSON.stringify(body)}`);
      }
    }

    async function sendViaSmtp() {
      if (!nodemailer) nodemailer = require('nodemailer');
      const host = process.env.SMTP_HOST;
      const port = Number(process.env.SMTP_PORT || 587);
      const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;
      if (!host || !toEmail || !fromEmail) throw new Error('SMTP not configured');
      const transporter = nodemailer.createTransport({ host, port, secure, auth: user && pass ? { user, pass } : undefined });
      await transporter.sendMail({ from: fromEmail, to: toEmail, subject: `[Contact] ${subject}`, text, html });
    }

    if (!toEmail) {
      context.res = { status: 501, body: { error: 'Email service not configured', setup: 'Set TO_EMAIL and one provider: RESEND_* or SMTP_* envs.' } };
      return;
    }

    // Dispatch by provider
    if (provider === 'resend') {
      await sendViaResend();
    } else if (provider === 'smtp') {
      await sendViaSmtp();
    } else if (hasResend) {
      await sendViaResend();
    } else if (hasSmtp) {
      await sendViaSmtp();
    } else {
      context.res = { status: 501, body: { error: 'Email service not configured', setup: 'Provide RESEND_API_KEY (and FROM_EMAIL), or SMTP_HOST (+ SMTP_PORT, SMTP_USER, SMTP_PASS).' } };
      return;
    }

    context.res = { status: 200, body: { ok: true } };
  } catch (e) {
    context.log('send-email error', e);
    context.res = { status: 500, body: { error: 'Failed to send email' } };
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

async function safeReadJson(res) {
  try {
    return await res.json();
  } catch {
    try { return await res.text(); } catch { return null; }
  }
}
