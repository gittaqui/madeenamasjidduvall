# Email setup (SMTP, Microsoft Graph, or Resend)

This function supports three providers. Set TO_EMAIL and choose one using MAIL_PROVIDER.

Common settings:

- TO_EMAIL: recipient address
- FROM_EMAIL: sender address (should match the mailbox for SMTP; for Graph, must be the sending user)
- MAIL_PROVIDER: smtp | graph (optional; auto-detects if omitted)

Option A — SMTP (Office 365, Gmail, custom):

- SMTP_HOST
- SMTP_PORT (587 for STARTTLS or 465 for SSL)
- SMTP_USER
- SMTP_PASS
- SMTP_SECURE (true for port 465; false otherwise)

Note: Office 365 often disables basic auth for SMTP. If you see 535 5.7.139 basic authentication disabled, use Graph instead or enable Authenticated SMTP in Exchange for that mailbox.

Option B — Microsoft Graph (passwordless, recommended for O365):

- GRAPH_TENANT_ID
- GRAPH_CLIENT_ID
- GRAPH_CLIENT_SECRET
- GRAPH_SENDER_UPN (for example, user at contoso dot com) or GRAPH_SENDER_ID (user GUID)

Your app registration must have Mail.Send application permission granted admin consent. The sender must be allowed to be impersonated by the app.

Option C — Resend (simple API):

- RESEND_API_KEY
- FROM_EMAIL must be a verified sender/domain in Resend; while unverified, Resend only delivers to specific test recipients and onboarding addresses.

Local example (do not commit secrets):

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "TO_EMAIL": "recipient@example.org",
    "FROM_EMAIL": "noreply@example.org",
    "MAIL_PROVIDER": "graph",
    "GRAPH_TENANT_ID": "<tenant-guid>",
    "GRAPH_CLIENT_ID": "<app-guid>",
    "GRAPH_CLIENT_SECRET": "<secret>",
    "GRAPH_SENDER_UPN": "noreply@example.org"
  }
}
```
