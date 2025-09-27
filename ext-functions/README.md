# External Functions (Subscribe + RSVP)

This project contains only the public-facing dynamic endpoints migrated out of the integrated Static Web Apps `api/` folder.

Endpoints:
- POST /api/subscribe
- POST /api/rsvp
- GET  /api/confirm (subscription token)

Not included: prayer-times (now served as static JSON or separate process).

## Local Development
```bash
cd ext-functions
npm install
func start
```

## Deployment (Azure CLI example)
```bash
az functionapp create \
  --resource-group <rg> \
  --consumption-plan-location <region> \
  --name <funcAppName> \
  --storage-account <storageAccount> \
  --runtime node --functions-version 4

az functionapp config appsettings set -g <rg> -n <funcAppName> --settings \
  SUBSCRIBERS_TABLE=Subscribers RSVP_TABLE_NAME=Rsvps
```

If using account URL + managed identity, also set:
```
STORAGE_ACCOUNT_TABLE_URL=https://<account>.table.core.windows.net
```

## CORS
Allow the static site origin:
```bash
az functionapp cors add -g <rg> -n <funcAppName> --allowed-origins https://www.madeenamasjid.com
```

## Front-End Integration
Add before other scripts:
```html
<script>window.RSVP_API_BASE = 'https://<funcAppName>.azurewebsites.net/api';</script>
```
The updated JS will fallback to `/api` if not set (for legacy / local integrated usage).
