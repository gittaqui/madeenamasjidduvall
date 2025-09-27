## Branching & Deployment Model

Branch: `main`
Deployment: Yes (Azure Static Web Apps CI/CD workflow)
Includes: Static front-end + `api/` Functions

Branch: `local-testing`
Deployment: No (unless manually merged to `main`)
Purpose: Safe iteration and experimentation. Use for:
- Trying alternate storage patterns.
- Refactoring RSVP/subscriber logic.
- Adding diagnostics or scripts not ready for production.

### Why Keep the API in Production
The front-end relies on dynamic endpoints for subscriptions, RSVPs, and prayer time content. Removing the `api/` folder would immediately break forms and admin pages. Centralizing dependencies inside `api/` already minimizes deploy weight without losing capability.

### Recommended Workflow
1. Create feature branch off `local-testing` (e.g. `feat/rsvp-capacity`).
2. Implement & test locally (`func start` inside `api/`).
3. Merge feature branch into `local-testing` for collaborative review.
4. When stable, merge `local-testing` into `main` to deploy.

### Future Optional Toggle (Not Implemented)
Add a marker file `.no-api` and modify the GitHub Actions workflow:
```yaml
      - name: Decide API location
        id: apiloc
        run: |
          if [ -f .no-api ]; then echo "api_location=" >> $GITHUB_OUTPUT; else echo "api_location=api" >> $GITHUB_OUTPUT; fi
      - uses: Azure/static-web-apps-deploy@v1
        with:
          api_location: ${{ steps.apiloc.outputs.api_location }}
```
This would let you temporarily disable backend deployment without deleting code.

### Environment / App Settings Reminder
Ensure production app settings DO NOT set complex (object) values for:
- `SUBSCRIBERS_TABLE`
- `RSVP_TABLE_NAME`
Leave them unset (defaults `Subscribers` / `Rsvps`) or set plain strings only.

### Local Development Quick Commands
```bash
# Start functions
cd api && func start

# Install dependency only for functions
npm install --prefix api <pkg>

# Run a quick subscription test (PowerShell):
pwsh ./scripts/test-endpoints.ps1 -BaseUrl https://localhost:4280 -NoWrites
```

---
*Last updated: branch strategy documentation to support Option A (keep API in production).* 