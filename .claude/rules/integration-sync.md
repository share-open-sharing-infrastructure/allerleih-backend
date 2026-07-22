---
paths:
  - "pb_hooks/integration_sync.pb.js"
  - "pb_hooks/jobs/integrationSync.js"
---

# Cron jobs (`integration_sync.pb.js` + `jobs/integrationSync.js`)

When `SYNC_CRON` / `REFRESH_CRON` are set (and `FRONTEND_URL` + `SYNC_SECRET` are present), the
backend registers the cron jobs `integration_sync` and `integration_refresh`, which POST the
frontend's bearer-protected integration endpoints on that schedule. A misconfigured job (cron set
but URL/secret missing, or a syntactically invalid cron expression) logs an error and is not
scheduled without affecting the sibling job; `DRY_MODE` skips the outbound call.
Superusers can inspect and manually fire the jobs in the admin UI (Settings → Crons) or via
`GET /api/crons` / `POST /api/crons/{id}` — the tests use the latter. Operational details live in
the frontend repo: `docs/operations/integration-sync.md`.
