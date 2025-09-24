# Local Development Setup

## Prerequisites

- Node.js 18+
- Azure Static Web Apps CLI: `npm install -g @azure/static-web-apps-cli`
- Azurite (installed globally `npm i -g azurite` or VS Code Azurite extension)
- (Optional) Azure Functions Core Tools v4 (SWA CLI will prompt if missing)

## First Run

```powershell
# From repo root
./start-local.ps1
```

This will:

1. Launch Azurite (unless `-NoAzurite` passed)
2. Install API dependencies if missing
3. Start SWA emulator on <http://localhost:4280> with Functions at 7071

## Authentication (Emulated)

`swa-cli.config.json` defines a static principal with roles `authenticated` and `admin` so the UI and POST endpoint work locally.
If you need to simulate a non-admin user, edit the file and remove `admin` then restart the emulator.

## Storage / Blob Writes

`api/local.settings.json` sets `STORAGE_CONNECTION_STRING=UseDevelopmentStorage=true` so the code writes to Azurite. After a successful POST to `/api/prayer-times`, inspect the Azurite blob container:

- Container: `config`
- Blob: `prayer-times.json`

If you want to test against a real storage account instead:

1. Remove `STORAGE_CONNECTION_STRING` from `local.settings.json`.
2. Set `STORAGE_ACCOUNT_BLOB_URL` to your account base URL.
3. Provide Azure identity credentials locally (e.g., `az login`) or a `STORAGE_CONNECTION_STRING` for that account.

## Useful URLs

- Home: <http://localhost:4280/>
- Admin Editor: <http://localhost:4280/admin-schedule.html>
- Auth Debug: <http://localhost:4280/debug-auth.html>
- Principal Endpoint: <http://localhost:4280/.auth/me>

## Testing API

```powershell
Invoke-RestMethod http://localhost:4280/api/prayer-times | ConvertTo-Json -Depth 6
```

POST update (example adds a note):

```powershell
$body = @{ updated = (Get-Date -Format 'yyyy-MM-dd'); months = @{} } | ConvertTo-Json -Depth 4
Invoke-RestMethod -Method Post -Uri http://localhost:4280/api/prayer-times -ContentType 'application/json' -Body $body
```

Static role principal emulation will allow the POST.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| auth widget still shows Sign in | Ensure emulator started with `--config swa-cli.config.json`; hard refresh (Ctrl+F5) |
| POST 404 | Confirm `api/prayer-times/function.json` exists and Functions host output shows route registered |
| Blob not created | Ensure Azurite running; check `STORAGE_CONNECTION_STRING` value; verify container name matches `PRAYER_TIMES_CONTAINER` |
| Old assets cached | Hard refresh or clear browser cache |

## Stopping

Press Ctrl+C in the terminal. Stop Azurite process separately if needed.

---

Happy coding!
