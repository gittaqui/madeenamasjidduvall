# Madeena Masjid Duvall

Project retitled to "Madeena Masjid Duvall".

## Where the name appears

Edit these to change branding later:

- All pages: navbar brand text and the HTML page title.
- Footer: heading in the first column and the copyright line.
- Home page (`index.html`): hero welcome line and the About section heading.

## Files updated

- `index.html`, `about.html`, `activity.html`, `blog.html`, `contact.html`, `event.html`, `sermon.html`, `team.html`, `testimonial.html`, `404.html`

## Contact details placeholders

- Topbar phone/email and footer address/phone are still placeholders. Replace with real details when available.

## Accessibility quick wins

- Add `aria-label` or `title` attributes for icon-only links and the back-to-top button.
- Add alt text for decorative images or mark them as `alt=""` when decorative.

## Attribution

Base front-end layout adapted from the original HTML Codex free template (credit retained per license). Footer text rephrased to: "Base template adapted from HTML Codex" with a link.

## Azure Static Web Apps + Functions API

This repo includes an `api/` Azure Functions app exposing `/api/prayer-times`:

- GET: returns `prayer-times.json` from a private Azure Storage Blob container.
- POST: requires Static Web Apps `admin` role, writes JSON to the same blob.

Configure these app settings for the Functions app (via SWA app settings). Current deployment uses STORAGE_* (legacy PRAYER_TIMES_* still accepted):

`STORAGE_ACCOUNT_BLOB_URL` e.g., `https://<account>.blob.core.windows.net`
`STORAGE_CONTAINER` (current: `content`)
`STORAGE_BLOB` (current: `prayer-times.json`)
Optional: `MANAGED_IDENTITY_CLIENT_ID` for user-assigned identity

Legacy equivalents:
`PRAYER_TIMES_CONTAINER`, `PRAYER_TIMES_BLOB` still work if STORAGE_* not set.

Authorization is defined in `staticwebapp.config.json` (anonymous GET, admin POST). The API double-checks the `admin` role from `X-MS-CLIENT-PRINCIPAL`.

### Table Storage (Subscribers / RSVPs) – Unified & Secure Access

The project now prefers a **single storage account** accessed via **Managed Identity** (no connection strings) for:

- Subscribers table (`Subscribers`)
- RSVPs table (`Rsvps`)

Front-end submission endpoints (subscribe / rsvp) have been migrated to an external Azure Function App. Internal admin & stats endpoints (`/api/subscribers`, `/api/rsvps`, `/api/rsvp-stats`, diagnostics) read the same tables by using the Static Web App managed identity.

To enable / verify this setup:

1. Assign the Static Web App managed identity the role: `Storage Table Data Contributor` on the chosen storage account.
2. SWA App Settings (no secrets required):
   - `STORAGE_ACCOUNT_TABLE_URL` = `https://<account>.table.core.windows.net`
   - `SUBSCRIBERS_TABLE` = `Subscribers`
   - `RSVP_TABLE_NAME` = `Rsvps`
   - (Optional) `MANAGED_IDENTITY_CLIENT_ID` if using a user-assigned identity.
3. Remove (or leave blank) any legacy `STORAGE_CONNECTION_STRING` or `TABLES_SAS` to force Managed Identity auth.
4. (Optional) Set `TABLES_VERBOSE_LOGGING=1` to emit a one-line log indicating which auth mode was used.

If you still have historical data in a *previous* storage account, migrate by exporting entities (Azure Storage Explorer / AzCopy) and upserting into the new account before assigning the identity.

Diagnostics:

- `GET /api/diag-tables` – shows which environment variables are present and will log `authMode` when verbose logging is enabled.
- `GET /api/diag-storage-full?key=<ADMIN_KEY>` – deeper scan (requires admin key) to confirm partition/entity counts.

All legacy internal write endpoints for subscribe/RSVP now return **410 Gone** with a pointer to the external base URL to avoid duplicate state.

## Existing Deployment

GitHub Actions workflow `.github/workflows/azure-static-web-app.yml` expects secret:
`AZURE_STATIC_WEB_APPS_API_TOKEN_GREEN_SKY_058AA821E`

Add under Settings > Secrets > Actions.

Deploys:

- Static content (repo root)
- Functions (`api/`)
- Storage env vars provided by portal/app settings

## Dependency Layout Simplified

The static front-end now has no root `package.json`; all Node dependencies live only inside `api/` (Azure Functions). This avoids duplicate `node_modules` and keeps SWA static upload lean.

Local commands examples:

```bash
# Install a new dependency for functions
npm install --prefix api @azure/data-tables

# Start functions locally
(cd api && func start)
```

If you later add a front-end build pipeline, reintroduce a root `package.json` with actual build steps and update the GitHub Actions workflow (`app_location`, `output_location`).
