# Email setup (Resend or SMTP)

This function supports multiple providers. Set TO_EMAIL (recipient) and choose ONE of the providers below. You can force a provider with MAIL_PROVIDER set to `sendgrid`, `resend`, or `smtp`.

Common settings:

- TO_EMAIL: recipient address
- FROM_EMAIL: sender address (must be verified for some providers)
- MAIL_PROVIDER: optional, one of resend | sendgrid | smtp

Option A — Resend (simple, free tier):

- RESEND_API_KEY

Option B — SMTP (any SMTP server, e.g., Gmail/Outlook/custom):

- SMTP_HOST
- SMTP_PORT (default 587; set to 465 with SMTP_SECURE=true for SSL)
- SMTP_USER (optional if server allows unauthenticated relay)
- SMTP_PASS (optional, required if SMTP_USER set)
- SMTP_SECURE (true/false)

Local example (do not commit secrets):

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "TO_EMAIL": "recipient@example.org",
    "FROM_EMAIL": "noreply@example.org",
    "MAIL_PROVIDER": "resend",
    "RESEND_API_KEY": "re_..."
  }
}
```
