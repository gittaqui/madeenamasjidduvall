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

- Keep the HTML Codex credit per the template license unless you obtain a credit removal license.

## Azure Static Web Apps + Functions API

This repo includes an `api/` Azure Functions app exposing `/api/prayer-times`:

- GET: returns `prayer-times.json` from a private Azure Storage Blob container.
- POST: requires Static Web Apps `admin` role, writes JSON to the same blob.

Configure these app settings for the Functions app (via SWA linked function app settings):

- `STORAGE_ACCOUNT_BLOB_URL`: e.g., `https://<account>.blob.core.windows.net`
- `PRAYER_TIMES_CONTAINER`: blob container name (default `config`)
- `PRAYER_TIMES_BLOB`: blob name (default `prayer-times.json`)
- Optional `MANAGED_IDENTITY_CLIENT_ID` when using a user-assigned identity

Authorization is set in `staticwebapp.config.json` to allow anonymous GET and admin-only POST. The API also validates `admin` from `X-MS-CLIENT-PRINCIPAL`.

