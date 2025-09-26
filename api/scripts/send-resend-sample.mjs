import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  console.error('Missing RESEND_API_KEY');
  process.exit(1);
}

const resend = new Resend(apiKey);

(async function () {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Acme <onboarding@resend.dev>',
      to: [process.env.TO_EMAIL || 'delivered@resend.dev'],
      subject: 'Hello World',
      html: '<strong>It works!</strong>'
    });

    if (error) {
      console.error('Resend error:', error);
      process.exit(2);
    }

    console.log('Resend data:', data);
  } catch (e) {
    console.error('Unexpected error:', e);
    process.exit(3);
  }
})();
