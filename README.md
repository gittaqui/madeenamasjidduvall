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

## No-Op Build Script (Oryx)

Azure Static Web Apps' Oryx build system detected a Node project because `server.js` sits at the repo root, then failed because there was no `build` (or `build:azure`) script. A minimal root `package.json` with a no-op build script was added:

```json
{
  "scripts": {
    "build": "echo Static site - no build needed"
  }
}
```

This keeps deployments green while still serving the site as pure static assets plus Functions. If you later introduce an actual asset pipeline (e.g. bundling, SCSS, minification), replace the script with the real build command and adjust `output_location` if needed.

If you prefer to remove Node detection entirely, you could relocate `server.js` into a `local-dev/` folder and update `LOCAL_DEV.md` accordingly (optional).
