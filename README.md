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

## Branch Strategy

We use two primary branches:

- `main`: Production deployment (static site + Azure Functions in `api/`). All subscriber / RSVP functionality remains active here.
- `local-testing`: Safe sandbox for local experiments. Changes here are not deployed until merged to `main`. You can prototype alternative storage backends or refactors without affecting production.

Rationale (chosen Option A): The site currently depends on the Functions API (`/api/subscribe`, `/api/rsvp`, `/api/prayer-times`). Removing or excluding `api/` from production would break core features. Consolidating dependencies under `api/` keeps deploy size lean while retaining dynamic capability.

If you ever decide to spin out the backend to an external Functions App:
1. Create a new repo or Azure Function resource.
2. Expose the endpoints under a stable domain (e.g. `https://functions.madeenamasjid.com`).
3. Update front-end JS fetch URLs and `staticwebapp.config.json` route auth.
4. Remove `api/` and set `api_location: ""` (or delete) in the GitHub Actions workflow.

For an on-demand API disable toggle (future Option C), a simple approach is to add a workflow conditional that skips `api_location` when a marker file (e.g. `.no-api`) exists on `main`. Not implemented yet—kept simple for reliability.

